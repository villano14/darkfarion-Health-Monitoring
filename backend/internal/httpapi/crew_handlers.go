package httpapi

import (
	"net/http"
	"strings"
	"time"

	"crewhealth/backend/internal/health"
)

// crew lists the people of the viewer's mission with the state of each body system.
func (s *Server) crew(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	v := viewer(r)
	var missionIDs []int64
	if v.Role == RoleAdmin {
		rows, err := s.db.Query(ctx, `SELECT id FROM missions ORDER BY start_date DESC`)
		if err != nil {
			s.fail(w, err)
			return
		}
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				s.fail(w, err)
				return
			}
			missionIDs = append(missionIDs, id)
		}
		rows.Close()
	} else {
		m, _, err := s.currentMission(ctx, v.ID)
		if err != nil {
			s.fail(w, err)
			return
		}
		if m != nil {
			missionIDs = append(missionIDs, m.ID)
		}
	}

	type person struct {
		Member
		Groups     map[string]health.GroupState `json:"groups"`
		Status     health.Status                `json:"status"`
		Tier       string                       `json:"tier"`
		LastDay    int                          `json:"lastDay"`
		TodayDone  int                          `json:"todayDone"`
		TodayTotal int                          `json:"todayTotal"`
		OpenAlerts int                          `json:"openAlerts"`
	}
	type missionOut struct {
		Mission *Mission `json:"mission"`
		Crew    []person `json:"crew"`
	}
	out := []missionOut{}
	daily := s.catalog.Daily()
	statusRank := map[health.Status]int{health.Normal: 0, health.Watch: 1, health.Alert: 2}
	tierRank := map[string]int{"none": 0, "self": 1, "crew": 2, "surgeon": 3}

	for _, mid := range missionIDs {
		var m Mission
		if err := s.db.QueryRow(ctx, `SELECT id, name, environment_id, start_date, planned_days FROM missions WHERE id = $1`, mid).
			Scan(&m.ID, &m.Name, &m.Environment, &m.StartDate, &m.PlannedDays); err != nil {
			s.fail(w, err)
			return
		}
		m.Start = m.StartDate.Format("2006-01-02")
		m.Day = health.MissionDay(m.StartDate, time.Now())
		members, err := s.members(ctx, mid)
		if err != nil {
			s.fail(w, err)
			return
		}
		mo := missionOut{Mission: &m, Crew: []person{}}
		for _, mem := range members {
			if mem.Role != RoleAstronaut && mem.Role != RoleCMO {
				continue // only people who log health data
			}
			log, _, err := s.loadLog(ctx, mem.ID, mid)
			if err != nil {
				s.fail(w, err)
				return
			}
			p := person{Member: mem, Groups: s.catalog.GroupStates(log, m.Day), Status: health.Normal, Tier: "none", TodayTotal: len(daily)}
			for _, g := range p.Groups {
				if statusRank[g.Status] > statusRank[p.Status] {
					p.Status = g.Status
				}
				if tierRank[g.Tier] > tierRank[p.Tier] {
					p.Tier = g.Tier
				}
			}
			for d := range log {
				p.LastDay = max(p.LastDay, d)
			}
			for _, i := range daily {
				if _, ok := log[m.Day][i.ID]; ok {
					p.TodayDone++
				}
			}
			if err := s.db.QueryRow(ctx, `SELECT count(*) FROM alerts WHERE user_id = $1 AND mission_id = $2 AND acked_at IS NULL`, mem.ID, mid).Scan(&p.OpenAlerts); err != nil {
				s.fail(w, err)
				return
			}
			mo.Crew = append(mo.Crew, p)
		}
		out = append(out, mo)
	}
	writeJSON(w, http.StatusOK, out)
}

type alertNote struct {
	ID        int64     `json:"id"`
	Author    string    `json:"author"`
	Role      string    `json:"role"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type alertOut struct {
	ID        int64       `json:"id"`
	UserID    int64       `json:"userId"`
	UserName  string      `json:"userName"`
	Indicator string      `json:"indicator"`
	Day       int         `json:"day"`
	Status    string      `json:"status"`
	Direction *string     `json:"direction"`
	Tier      string      `json:"tier"`
	Value     []float64   `json:"value"`
	CreatedAt time.Time   `json:"createdAt"`
	AckedBy   *string     `json:"ackedBy"`
	AckedAt   *time.Time  `json:"ackedAt"`
	Notes     []alertNote `json:"notes"`
}

// listAlerts: astronauts see their own; the crew medical officer and flight surgeon see their missions'.
// ?status=open hides acknowledged alerts.
func (s *Server) listAlerts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	v := viewer(r)
	where := []string{"true"}
	args := []any{}
	switch v.Role {
	case RoleAstronaut:
		args = append(args, v.ID)
		where = append(where, "a.user_id = $1")
	case RoleCMO, RoleSurgeon:
		args = append(args, v.ID)
		where = append(where, "a.mission_id IN (SELECT mission_id FROM mission_members WHERE user_id = $1)")
	}
	if r.URL.Query().Get("status") == "open" {
		where = append(where, "a.acked_at IS NULL")
	}
	rows, err := s.db.Query(ctx, `
		SELECT a.id, a.user_id, u.name, a.indicator_id, a.day, a.status, a.direction, a.tier, a.value, a.created_at, ack.name, a.acked_at
		FROM alerts a JOIN users u ON u.id = a.user_id LEFT JOIN users ack ON ack.id = a.acked_by
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY a.acked_at IS NOT NULL, CASE a.tier WHEN 'surgeon' THEN 0 ELSE 1 END, a.day DESC, a.id DESC LIMIT 200`, args...)
	if err != nil {
		s.fail(w, err)
		return
	}
	list := []*alertOut{}
	byID := map[int64]*alertOut{}
	for rows.Next() {
		a := &alertOut{Notes: []alertNote{}}
		if err := rows.Scan(&a.ID, &a.UserID, &a.UserName, &a.Indicator, &a.Day, &a.Status, &a.Direction, &a.Tier, &a.Value, &a.CreatedAt, &a.AckedBy, &a.AckedAt); err != nil {
			rows.Close()
			s.fail(w, err)
			return
		}
		list = append(list, a)
		byID[a.ID] = a
	}
	rows.Close()
	if len(list) > 0 {
		ids := make([]int64, 0, len(list))
		for _, a := range list {
			ids = append(ids, a.ID)
		}
		nrows, err := s.db.Query(ctx, `
			SELECT n.alert_id, n.id, u.name, u.role, n.body, n.created_at
			FROM alert_notes n JOIN users u ON u.id = n.author_id WHERE n.alert_id = ANY($1) ORDER BY n.created_at`, ids)
		if err != nil {
			s.fail(w, err)
			return
		}
		for nrows.Next() {
			var aid int64
			var n alertNote
			if err := nrows.Scan(&aid, &n.ID, &n.Author, &n.Role, &n.Body, &n.CreatedAt); err != nil {
				nrows.Close()
				s.fail(w, err)
				return
			}
			byID[aid].Notes = append(byID[aid].Notes, n)
		}
		nrows.Close()
	}
	writeJSON(w, http.StatusOK, list)
}

// alertOwner returns the alert's user after checking the viewer can see it.
func (s *Server) alertOwner(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	id, ok := pathID(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid_id")
		return 0, 0, false
	}
	var owner int64
	if err := s.db.QueryRow(r.Context(), `SELECT user_id FROM alerts WHERE id = $1`, id).Scan(&owner); err != nil {
		s.fail(w, err)
		return 0, 0, false
	}
	can, err := s.canView(r.Context(), viewer(r), owner)
	if err != nil {
		s.fail(w, err)
		return 0, 0, false
	}
	if !can {
		writeError(w, http.StatusForbidden, "forbidden")
		return 0, 0, false
	}
	return id, owner, true
}

func (s *Server) ackAlert(w http.ResponseWriter, r *http.Request) {
	id, _, ok := s.alertOwner(w, r)
	if !ok {
		return
	}
	if _, err := s.db.Exec(r.Context(), `UPDATE alerts SET acked_by = $1, acked_at = now() WHERE id = $2 AND acked_at IS NULL`, viewer(r).ID, id); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) addNote(w http.ResponseWriter, r *http.Request) {
	id, _, ok := s.alertOwner(w, r)
	if !ok {
		return
	}
	var body struct{ Body string }
	if err := readJSON(r, &body); err != nil || strings.TrimSpace(body.Body) == "" || len(body.Body) > 2000 {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	if _, err := s.db.Exec(r.Context(), `INSERT INTO alert_notes (alert_id, author_id, body) VALUES ($1, $2, $3)`, id, viewer(r).ID, strings.TrimSpace(body.Body)); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"ok": true})
}
