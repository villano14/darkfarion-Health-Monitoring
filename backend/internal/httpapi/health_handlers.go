package httpapi

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"crewhealth/backend/internal/health"
)

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u, err := s.user(ctx, viewer(r).ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	m, title, err := s.currentMission(ctx, u.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	out := map[string]any{"user": u, "title": title, "mission": nil}
	if m != nil {
		crew, err := s.members(ctx, m.ID)
		if err != nil {
			s.fail(w, err)
			return
		}
		out["mission"] = map[string]any{"mission": m, "crew": crew}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getCatalog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, max-age=300")
	writeJSON(w, http.StatusOK, s.catalog)
}

// listReadings returns a user's whole mission history (default: the viewer).
func (s *Server) listReadings(w http.ResponseWriter, r *http.Request) {
	id, ok := s.subject(w, r)
	if !ok {
		return
	}
	m, _, err := s.currentMission(r.Context(), id)
	if err != nil {
		s.fail(w, err)
		return
	}
	if m == nil {
		writeJSON(w, http.StatusOK, map[string]any{"userId": id, "day": 0, "readings": []ReadingRow{}})
		return
	}
	_, list, err := s.loadLog(r.Context(), id, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	if list == nil {
		list = []ReadingRow{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"userId": id, "day": m.Day, "readings": list})
}

// createReadings stores today's readings for the signed-in crew member and raises alerts when needed.
//
//	{"values": {"hr": [72], "bp": [118, 76]}, "source": "manual" | "camera"}
func (s *Server) createReadings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Values  map[string][]float64 `json:"values"`
		Sources map[string]string    `json:"sources"`
	}
	if err := readJSON(r, &body); err != nil || len(body.Values) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	for id, v := range body.Values {
		i := s.catalog.Indicator(id)
		// Onboard scans and feeds are written by equipment, not typed by the astronaut.
		if i == nil || i.Input == "scan" || !i.Valid(v) {
			writeError(w, http.StatusBadRequest, "invalid_value:"+id)
			return
		}
		if src := body.Sources[id]; src != "" && src != "manual" && !(src == "camera" && id == "hr") {
			writeError(w, http.StatusBadRequest, "invalid_source:"+id)
			return
		}
	}

	ctx := r.Context()
	v := viewer(r)
	m, _, err := s.currentMission(ctx, v.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	if m == nil {
		writeError(w, http.StatusConflict, "no_mission")
		return
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		s.fail(w, err)
		return
	}
	defer tx.Rollback(ctx)
	for id, value := range body.Values {
		src := body.Sources[id]
		if src == "" {
			src = "manual"
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO readings (user_id, mission_id, day, indicator_id, value, source, recorded_by)
			VALUES ($1, $2, $3, $4, $5, $6, $1)
			ON CONFLICT (user_id, mission_id, day, indicator_id)
			DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, recorded_at = now()`,
			v.ID, m.ID, m.Day, id, value, src); err != nil {
			s.fail(w, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		s.fail(w, err)
		return
	}
	log, list, err := s.loadLog(ctx, v.ID, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	if err := RaiseAlerts(ctx, s.db, s.catalog, log, v.ID, m.ID, m.Day); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"userId": v.ID, "day": m.Day, "readings": list})
}

// --- Routine and progress -------------------------------------------------------

type completions map[int]map[string]bool

func (s *Server) loadCompletions(ctx context.Context, userID, missionID int64) (completions, error) {
	rows, err := s.db.Query(ctx, `SELECT day, task_id FROM task_completions WHERE user_id = $1 AND mission_id = $2`, userID, missionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := completions{}
	for rows.Next() {
		var day int
		var task string
		if err := rows.Scan(&day, &task); err != nil {
			return nil, err
		}
		if out[day] == nil {
			out[day] = map[string]bool{}
		}
		out[day][task] = true
	}
	return out, rows.Err()
}

func (s *Server) taskDone(t *health.Task, log health.Log, done completions, day int) bool {
	if t.Kind == "exercise" {
		return done[day][t.ID]
	}
	for _, id := range t.Indicators {
		if _, ok := log[day][id]; !ok {
			return false
		}
	}
	return true
}

func (s *Server) routine(w http.ResponseWriter, r *http.Request) {
	id, ok := s.subject(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	m, _, err := s.currentMission(ctx, id)
	if err != nil || m == nil {
		if err != nil {
			s.fail(w, err)
		} else {
			writeJSON(w, http.StatusOK, map[string]any{"day": 0, "tasks": []any{}})
		}
		return
	}
	log, _, err := s.loadLog(ctx, id, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	done, err := s.loadCompletions(ctx, id, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	type item struct {
		ID   string `json:"id"`
		Done bool   `json:"done"`
	}
	tasks := make([]item, 0, len(s.catalog.Tasks))
	for _, t := range s.catalog.Tasks {
		tasks = append(tasks, item{t.ID, s.taskDone(t, log, done, m.Day)})
	}
	writeJSON(w, http.StatusOK, map[string]any{"day": m.Day, "tasks": tasks})
}

func (s *Server) toggleTask(w http.ResponseWriter, r *http.Request) {
	t := s.catalog.Task(r.PathValue("task"))
	if t == nil || t.Kind != "exercise" {
		writeError(w, http.StatusBadRequest, "not_an_exercise_task")
		return
	}
	ctx := r.Context()
	v := viewer(r)
	m, _, err := s.currentMission(ctx, v.ID)
	if err != nil || m == nil {
		if err != nil {
			s.fail(w, err)
		} else {
			writeError(w, http.StatusConflict, "no_mission")
		}
		return
	}
	tag, err := s.db.Exec(ctx, `DELETE FROM task_completions WHERE user_id = $1 AND mission_id = $2 AND day = $3 AND task_id = $4`, v.ID, m.ID, m.Day, t.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		if _, err := s.db.Exec(ctx, `INSERT INTO task_completions (user_id, mission_id, day, task_id) VALUES ($1, $2, $3, $4)`, v.ID, m.ID, m.Day, t.ID); err != nil {
			s.fail(w, err)
			return
		}
	}
	s.routine(w, r)
}

type achievementProgress struct {
	ID       string `json:"id"`
	Earned   bool   `json:"earned"`
	Progress int    `json:"progress"`
	Goal     int    `json:"goal"`
}

// progress is the gamification summary: streak, points and achievements, all derived from real records.
func (s *Server) progress(w http.ResponseWriter, r *http.Request) {
	id, ok := s.subject(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	m, _, err := s.currentMission(ctx, id)
	if err != nil {
		s.fail(w, err)
		return
	}
	if m == nil {
		writeJSON(w, http.StatusOK, map[string]any{"streak": 0, "bestStreak": 0, "points": 0, "level": 1, "achievements": []any{}})
		return
	}
	log, rows, err := s.loadLog(ctx, id, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	done, err := s.loadCompletions(ctx, id, m.ID)
	if err != nil {
		s.fail(w, err)
		return
	}
	daily := s.catalog.Daily()
	checkedIn := func(day int) bool {
		for _, i := range daily {
			if _, ok := log[day][i.ID]; !ok {
				return false
			}
		}
		return true
	}
	// Longest run of consecutive days where fn holds, and the run ending at the last day (today, or
	// yesterday while today is still in progress).
	runs := func(fn func(int) bool) (best, current int) {
		run := 0
		for d := 1; d <= m.Day; d++ {
			if fn(d) {
				run++
				best = max(best, run)
			} else if d < m.Day {
				run = 0
			}
		}
		return best, run
	}
	bestStreak, streak := runs(checkedIn)
	bestSleep, _ := runs(func(d int) bool { v, ok := log[d]["sleep"]; return ok && v[0] >= 7 })
	bestWater, _ := runs(func(d int) bool { v, ok := log[d]["water"]; return ok && v[0] >= 2 })

	points, exercises, perfect, anyCheckin := 0, 0, false, false
	for d := 1; d <= m.Day; d++ {
		all := true
		for _, t := range s.catalog.Tasks {
			if s.taskDone(t, log, done, d) {
				points += t.Points
				if t.Kind == "exercise" {
					exercises++
				}
			} else {
				all = false
			}
		}
		perfect = perfect || all
		anyCheckin = anyCheckin || checkedIn(d)
	}
	camera := false
	for _, r := range rows {
		camera = camera || (r.Indicator == "hr" && r.Source == "camera")
	}
	b2i := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}
	state := map[string][2]int{ // progress, goal
		"first-checkin": {b2i(anyCheckin), 1},
		"streak-7":      {min(bestStreak, 7), 7},
		"streak-30":     {min(bestStreak, 30), 30},
		"sleep-7":       {min(bestSleep, 7), 7},
		"hydration-7":   {min(bestWater, 7), 7},
		"exercise-10":   {min(exercises, 10), 10},
		"camera-pulse":  {b2i(camera), 1},
		"perfect-day":   {b2i(perfect), 1},
	}
	list := make([]achievementProgress, 0, len(s.catalog.Achievements))
	for _, a := range s.catalog.Achievements {
		st := state[a.ID]
		earned := st[1] > 0 && st[0] >= st[1]
		if earned {
			points += a.Points
		}
		list = append(list, achievementProgress{a.ID, earned, st[0], st[1]})
	}
	todayDone := 0
	for _, i := range daily {
		if _, ok := log[m.Day][i.ID]; ok {
			todayDone++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"streak": streak, "bestStreak": bestStreak, "points": points, "level": 1 + points/1000,
		"todayDone": todayDone, "todayTotal": len(daily), "achievements": list,
	})
}

// --- Report ---------------------------------------------------------------------

func formatValue(i *health.Indicator, v []float64) string {
	if v == nil {
		return "—"
	}
	switch {
	case i.Input == "bp":
		return fmt.Sprintf("%.0f/%.0f", v[0], v[1])
	case i.ID == "creatinine":
		return fmt.Sprintf("%.2f", v[0])
	case i.Step < 1:
		if (i.ID == "bone" || i.ID == "muscle") && v[0] > 0 {
			return fmt.Sprintf("+%.1f", v[0])
		}
		return fmt.Sprintf("%.1f", v[0])
	}
	return fmt.Sprintf("%.0f", v[0])
}

// summary is the plain-text health snapshot used by the flight surgeon report and by Orbi.
func (s *Server) summary(ctx context.Context, userID int64, lang, envID string, forChat bool) (string, error) {
	u, err := s.user(ctx, userID)
	if err != nil {
		return "", err
	}
	m, title, err := s.currentMission(ctx, userID)
	if err != nil {
		return "", err
	}
	if m == nil {
		return "", fmt.Errorf("user %d has no mission", userID)
	}
	if envID == "" || s.catalog.Environment(envID) == nil {
		envID = m.Environment
	}
	env := s.catalog.Environment(envID)
	log, _, err := s.loadLog(ctx, userID, m.ID)
	if err != nil {
		return "", err
	}
	states := s.catalog.GroupStates(log, m.Day)
	es := lang == "es"
	t := func(en, sp string) string {
		if es {
			return sp
		}
		return en
	}
	var b strings.Builder
	if forChat {
		fmt.Fprintf(&b, "Crew member: %s (%s), %s\n", u.Name, title, m.Name)
		fmt.Fprintf(&b, "Mission day %d · Environment: %s (%s, one-way signal delay to Earth %s", m.Day, env.Name["en"], env.Gravity, env.Delay)
		if env.Autonomous {
			b.WriteString(", crew must act autonomously")
		}
		b.WriteString(")\n\nBody systems (latest readings):\n")
	} else {
		fmt.Fprintf(&b, "Qhalikay %s · %s · %s (%s)\n", t("report", "reporte"), m.Name, u.Name, title)
		fmt.Fprintf(&b, "%s %d · %s (%s, %s %s)\n", t("Mission day", "Día de misión"), m.Day, env.Name[lang], env.Gravity, t("signal delay", "retraso de señal"), env.Delay)
		fmt.Fprintf(&b, "%s %s UTC\n\n", t("Generated", "Generado"), time.Now().UTC().Format("2006-01-02 15:04"))
	}
	statusName := func(st health.Status) string {
		if !es {
			return string(st)
		}
		return map[health.Status]string{health.Normal: "normal", health.Watch: "vigilar", health.Alert: "alerta"}[st]
	}
	textLang := lang
	if forChat {
		textLang = "en"
	}
	for _, g := range s.catalog.Groups {
		st := states[g.ID]
		if forChat {
			fmt.Fprintf(&b, "- %s: %s", g.Text["en"].Name, st.Status)
			if st.Tier != "none" {
				fmt.Fprintf(&b, " (escalation: %s)", st.Tier)
			}
			b.WriteString("\n")
		} else {
			fmt.Fprintf(&b, "%s: %s", g.Text[lang].Name, strings.ToUpper(statusName(st.Status)))
			if st.Tier == "surgeon" {
				b.WriteString(t(" — needs review", " — requiere revisión"))
			}
			b.WriteString("\n")
		}
		for _, i := range s.catalog.IndicatorsOf(g.ID) {
			text := i.Text[textLang]
			unit := i.Unit
			if text.Unit != nil {
				unit = *text.Unit
			}
			v, at := log.Latest(i.ID, m.Day)
			if v == nil {
				fmt.Fprintf(&b, "  · %s: %s\n", text.Label, t("no reading", "sin lectura"))
				continue
			}
			a := i.Assess(v)
			risk := ""
			if a.Direction != "" {
				risk = text.Risks[string(a.Status)+"-"+a.Direction]
			}
			if forChat {
				fmt.Fprintf(&b, "  · %s: %s %s (normal %s; %s", text.Label, formatValue(i, v), unit, i.Range, a.Status)
				if risk != "" {
					fmt.Fprintf(&b, ", %s", risk)
				}
				fmt.Fprintf(&b, "; day %d)\n", at)
			} else {
				fmt.Fprintf(&b, "  · %s: %s %s (%s; %s %d)", text.Label, formatValue(i, v), unit, statusName(a.Status), t("day", "día"), at)
				if risk != "" {
					fmt.Fprintf(&b, " — %s", risk)
				}
				b.WriteString("\n")
			}
		}
	}
	b.WriteString("\n" + t("Educational tool. Not a medical device.", "Herramienta educativa. No es un dispositivo médico."))
	return b.String(), nil
}

func (s *Server) report(w http.ResponseWriter, r *http.Request) {
	id, ok := s.subject(w, r)
	if !ok {
		return
	}
	text, err := s.summary(r.Context(), id, langOf(r), r.URL.Query().Get("environment"), false)
	if err != nil {
		s.fail(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte(text))
}
