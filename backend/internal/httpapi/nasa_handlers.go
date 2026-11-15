package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"crewhealth/backend/internal/chat"
)

func (s *Server) spaceWeather(w http.ResponseWriter, r *http.Request) {
	report, err := s.weather.Get(r.Context())
	if err != nil {
		writeError(w, http.StatusBadGateway, "unavailable")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// osdrPanel serves the real Inspiration4 blood panel (NASA OSDR OSD-575) from the database.
func (s *Server) osdrPanel(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var source, url, mission string
	var ranges []byte
	if err := s.db.QueryRow(ctx, `SELECT source, url, mission, lab_ranges FROM osdr_datasets WHERE id = 'OSD-575'`).Scan(&source, &url, &mission, &ranges); err != nil {
		s.fail(w, err)
		return
	}
	rows, err := s.db.Query(ctx, `SELECT crew, timepoint, glucose, calcium, creatinine FROM osdr_cmp_samples WHERE dataset_id = 'OSD-575' ORDER BY crew, sort`)
	if err != nil {
		s.fail(w, err)
		return
	}
	defer rows.Close()
	type sample struct {
		Crew       string   `json:"crew"`
		Timepoint  string   `json:"timepoint"`
		Glucose    *float64 `json:"glucose"`
		Calcium    *float64 `json:"calcium"`
		Creatinine *float64 `json:"creatinine"`
	}
	samples := []sample{}
	timepoints := []string{}
	seen := map[string]bool{}
	for rows.Next() {
		var x sample
		if err := rows.Scan(&x.Crew, &x.Timepoint, &x.Glucose, &x.Calcium, &x.Creatinine); err != nil {
			s.fail(w, err)
			return
		}
		samples = append(samples, x)
		if !seen[x.Timepoint] {
			seen[x.Timepoint] = true
			timepoints = append(timepoints, x.Timepoint)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"source": source, "url": url, "mission": mission, "labRanges": json.RawMessage(ranges),
		"timepoints": timepoints, "samples": samples,
	})
}

const (
	maxTurns = 20
	maxChars = 4000
)

// chatHandler streams Orbi's answer as newline-delimited JSON:
// {"type":"text","text":"..."} · {"type":"error","code":"..."} · {"type":"done"}
// The health context is built here from the database, never trusted from the browser.
func (s *Server) chatHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Messages    []chat.Message `json:"messages"`
		Lang        string         `json:"lang"`
		Environment string         `json:"environment"`
	}
	if err := readJSON(r, &body); err != nil || len(body.Messages) == 0 || len(body.Messages) > maxTurns {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	for i, m := range body.Messages {
		if (m.Role != "user" && m.Role != "assistant") || strings.TrimSpace(m.Content) == "" {
			writeError(w, http.StatusBadRequest, "invalid_request")
			return
		}
		if len(m.Content) > maxChars {
			body.Messages[i].Content = m.Content[:maxChars]
		}
	}
	if body.Messages[0].Role != "user" || body.Messages[len(body.Messages)-1].Role != "user" {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	ctx := r.Context()
	context, err := s.summary(ctx, viewer(r).ID, "en", body.Environment, true)
	if err != nil {
		s.fail(w, err)
		return
	}
	language := "English"
	if body.Lang == "es" {
		language = "Spanish"
	}
	last := &body.Messages[len(body.Messages)-1]
	last.Content = "<language>" + language + "</language>\n<crew_health_context>\n" + context + "\n</crew_health_context>\n\n" + last.Content

	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher, _ := w.(http.Flusher)
	enc := json.NewEncoder(w)
	send := func(v any) {
		_ = enc.Encode(v)
		if flusher != nil {
			flusher.Flush()
		}
	}
	err = s.chat.Stream(ctx, body.Messages, func(text string) { send(map[string]string{"type": "text", "text": text}) })
	if err != nil {
		code := "unknown"
		var ce *chat.Error
		if errors.As(err, &ce) {
			code = ce.Code
		}
		slog.Warn("orbi", "err", err)
		send(map[string]string{"type": "error", "code": code})
		return
	}
	send(map[string]string{"type": "done"})
}
