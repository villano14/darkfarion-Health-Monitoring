package httpapi

import (
	"errors"
	"net/http"
	"net/mail"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"crewhealth/backend/internal/health"
)

func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT u.id, u.email, u.name, u.initials, u.role, coalesce(m.name, ''), coalesce(mm.title, '')
		FROM users u
		LEFT JOIN LATERAL (SELECT mission_id, title FROM mission_members WHERE user_id = u.id ORDER BY mission_id DESC LIMIT 1) mm ON true
		LEFT JOIN missions m ON m.id = mm.mission_id
		ORDER BY u.id`)
	if err != nil {
		s.fail(w, err)
		return
	}
	defer rows.Close()
	type row struct {
		User
		Mission string `json:"mission"`
		Title   string `json:"title"`
	}
	out := []row{}
	for rows.Next() {
		var x row
		if err := rows.Scan(&x.ID, &x.Email, &x.Name, &x.Initials, &x.Role, &x.Mission, &x.Title); err != nil {
			s.fail(w, err)
			return
		}
		out = append(out, x)
	}
	writeJSON(w, http.StatusOK, out)
}

func initialsOf(name string) string {
	var b strings.Builder
	for _, part := range strings.Fields(name) {
		if r := []rune(part); len(r) > 0 && b.Len() < 2 {
			b.WriteString(strings.ToUpper(string(r[0])))
		}
	}
	return b.String()
}

func (s *Server) adminCreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email, Name, Password, Role, Title string
		MissionID                          int64 `json:"missionId"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	body.Email, body.Name = strings.TrimSpace(body.Email), strings.TrimSpace(body.Name)
	if _, err := mail.ParseAddress(body.Email); err != nil || body.Name == "" || len(body.Password) < 8 ||
		!slices.Contains([]string{RoleAstronaut, RoleCMO, RoleSurgeon, RoleAdmin}, body.Role) {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	hash, err := HashPassword(body.Password)
	if err != nil {
		s.fail(w, err)
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		s.fail(w, err)
		return
	}
	defer tx.Rollback(ctx)
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO users (email, password_hash, name, initials, role) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (email) DO NOTHING RETURNING id`, body.Email, hash, body.Name, initialsOf(body.Name), body.Role).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusConflict, "email_taken")
		return
	}
	if err != nil {
		s.fail(w, err)
		return
	}
	if body.MissionID > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO mission_members (mission_id, user_id, title) VALUES ($1, $2, $3)`, body.MissionID, id, body.Title); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_mission")
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) adminMissions(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT m.id, m.name, m.environment_id, m.start_date, m.planned_days, count(mm.user_id)
		FROM missions m LEFT JOIN mission_members mm ON mm.mission_id = m.id
		GROUP BY m.id ORDER BY m.start_date DESC`)
	if err != nil {
		s.fail(w, err)
		return
	}
	defer rows.Close()
	type row struct {
		Mission
		Members int `json:"members"`
	}
	out := []row{}
	for rows.Next() {
		var x row
		if err := rows.Scan(&x.ID, &x.Name, &x.Environment, &x.StartDate, &x.PlannedDays, &x.Members); err != nil {
			s.fail(w, err)
			return
		}
		x.Start = x.StartDate.Format("2006-01-02")
		x.Day = health.MissionDay(x.StartDate, time.Now())
		out = append(out, x)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) adminCreateMission(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string `json:"name"`
		Environment string `json:"environment"`
		StartDate   string `json:"startDate"`
		PlannedDays int    `json:"plannedDays"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	start, err := time.Parse("2006-01-02", body.StartDate)
	if err != nil || strings.TrimSpace(body.Name) == "" || s.catalog.Environment(body.Environment) == nil || body.PlannedDays < 1 || body.PlannedDays > 3000 {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	var id int64
	if err := s.db.QueryRow(r.Context(), `INSERT INTO missions (name, environment_id, start_date, planned_days) VALUES ($1, $2, $3, $4) RETURNING id`,
		strings.TrimSpace(body.Name), body.Environment, start, body.PlannedDays).Scan(&id); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (s *Server) adminAddMember(w http.ResponseWriter, r *http.Request) {
	mid, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid_id")
		return
	}
	var body struct {
		UserID int64  `json:"userId"`
		Title  string `json:"title"`
	}
	if err := readJSON(r, &body); err != nil || body.UserID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO mission_members (mission_id, user_id, title) VALUES ($1, $2, $3)
		ON CONFLICT (mission_id, user_id) DO UPDATE SET title = EXCLUDED.title`, mid, body.UserID, body.Title); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_member")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
