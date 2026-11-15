package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"crewhealth/backend/internal/health"
)

// Execer is satisfied by the pool and by transactions.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type User struct {
	ID       int64  `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Initials string `json:"initials"`
	Role     string `json:"role"`
}

type Mission struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Environment string    `json:"environment"`
	StartDate   time.Time `json:"-"`
	Start       string    `json:"startDate"`
	PlannedDays int       `json:"plannedDays"`
	Day         int       `json:"day"`
}

type Member struct {
	User
	Title string `json:"title"`
}

func (s *Server) user(ctx context.Context, id int64) (User, error) {
	var u User
	err := s.db.QueryRow(ctx, `SELECT id, email, name, initials, role FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.Initials, &u.Role)
	return u, err
}

// currentMission is the most recent mission the user belongs to, with their crew position.
func (s *Server) currentMission(ctx context.Context, userID int64) (*Mission, string, error) {
	var m Mission
	var title string
	err := s.db.QueryRow(ctx, `
		SELECT m.id, m.name, m.environment_id, m.start_date, m.planned_days, mm.title
		FROM missions m JOIN mission_members mm ON mm.mission_id = m.id
		WHERE mm.user_id = $1 ORDER BY m.start_date DESC, m.id DESC LIMIT 1`, userID).
		Scan(&m.ID, &m.Name, &m.Environment, &m.StartDate, &m.PlannedDays, &title)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	m.Start = m.StartDate.Format("2006-01-02")
	m.Day = health.MissionDay(m.StartDate, time.Now())
	return &m, title, nil
}

func (s *Server) members(ctx context.Context, missionID int64) ([]Member, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.email, u.name, u.initials, u.role, mm.title
		FROM mission_members mm JOIN users u ON u.id = mm.user_id
		WHERE mm.mission_id = $1
		ORDER BY CASE u.role WHEN 'astronaut' THEN 0 WHEN 'crew_medical_officer' THEN 0 ELSE 1 END, u.name`, missionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Email, &m.Name, &m.Initials, &m.Role, &m.Title); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// canView: astronauts see only themselves; the crew medical officer and the flight surgeon see the
// people of the missions they belong to; mission control sees everyone.
func (s *Server) canView(ctx context.Context, v Viewer, subject int64) (bool, error) {
	if v.ID == subject || v.Role == RoleAdmin {
		return true, nil
	}
	if v.Role != RoleCMO && v.Role != RoleSurgeon {
		return false, nil
	}
	var ok bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM mission_members a JOIN mission_members b ON a.mission_id = b.mission_id
			WHERE a.user_id = $1 AND b.user_id = $2)`, v.ID, subject).Scan(&ok)
	return ok, err
}

// subject resolves ?user= (defaults to the viewer) and checks access. It writes the error response itself.
func (s *Server) subject(w http.ResponseWriter, r *http.Request) (int64, bool) {
	v := viewer(r)
	id := v.ID
	if raw := r.URL.Query().Get("user"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid_user")
			return 0, false
		}
		id = n
	}
	ok, err := s.canView(r.Context(), v, id)
	if err != nil {
		s.fail(w, err)
		return 0, false
	}
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden")
		return 0, false
	}
	return id, true
}

type ReadingRow struct {
	Day       int       `json:"day"`
	Indicator string    `json:"indicator"`
	Value     []float64 `json:"value"`
	Source    string    `json:"source"`
}

// loadLog reads every reading of a user in a mission.
func (s *Server) loadLog(ctx context.Context, userID, missionID int64) (health.Log, []ReadingRow, error) {
	rows, err := s.db.Query(ctx, `SELECT day, indicator_id, value, source FROM readings WHERE user_id = $1 AND mission_id = $2 ORDER BY day, indicator_id`, userID, missionID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	log := health.Log{}
	var list []ReadingRow
	for rows.Next() {
		var r ReadingRow
		if err := rows.Scan(&r.Day, &r.Indicator, &r.Value, &r.Source); err != nil {
			return nil, nil, err
		}
		log.Set(r.Day, r.Indicator, r.Value)
		list = append(list, r)
	}
	return log, list, rows.Err()
}

// RaiseAlerts records an alert for every reading of the day that needs the crew or the flight surgeon.
// Shared by new readings and the demo seed.
func RaiseAlerts(ctx context.Context, q Execer, c *health.Catalog, log health.Log, userID, missionID int64, day int) error {
	for id, value := range log[day] {
		i := c.Indicator(id)
		if i == nil {
			continue
		}
		a := i.Assess(value)
		tier := health.TierFor(a.Status, log.AlertStreak(i, day))
		if tier != "crew" && tier != "surgeon" {
			continue
		}
		if _, err := q.Exec(ctx, `
			INSERT INTO alerts (user_id, mission_id, indicator_id, day, status, direction, tier, value)
			VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8)
			ON CONFLICT (user_id, mission_id, indicator_id, day)
			DO UPDATE SET status = EXCLUDED.status, direction = EXCLUDED.direction, tier = EXCLUDED.tier, value = EXCLUDED.value`,
			userID, missionID, id, day, string(a.Status), a.Direction, tier, value); err != nil {
			return err
		}
	}
	return nil
}
