// Package nasa reads live space weather from NASA DONKI and keeps it cached in PostgreSQL.
package nasa

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	donki    = "https://api.nasa.gov/DONKI"
	cacheKey = "donki"
	cacheTTL = 30 * time.Minute
	// Solar particle events in this window count as "today" for the solar indicator.
	RecentDays = 3
)

type SEP struct {
	ID         string `json:"id"`
	Time       string `json:"time"`
	Link       string `json:"link,omitempty"`
	Instrument string `json:"instrument,omitempty"`
}

type Flare struct {
	ID        string `json:"id"`
	Time      string `json:"time"`
	ClassType string `json:"classType,omitempty"`
	Link      string `json:"link,omitempty"`
}

type Report struct {
	Source    string  `json:"source"`
	FetchedAt string  `json:"fetchedAt"`
	SEP       []SEP   `json:"sep"`
	Flares    []Flare `json:"flares"`
	Stale     bool    `json:"stale,omitempty"`
}

// RecentSEP counts solar particle events in the last RecentDays days.
func (r *Report) RecentSEP(now time.Time) int {
	n := 0
	for _, e := range r.SEP {
		if t, err := time.Parse("2006-01-02T15:04Z", e.Time); err == nil && now.Sub(t) <= RecentDays*24*time.Hour {
			n++
		}
	}
	return n
}

type Weather struct {
	db     *pgxpool.Pool
	key    string
	client *http.Client
	mu     sync.Mutex
}

func NewWeather(db *pgxpool.Pool, apiKey string) *Weather {
	if apiKey == "" {
		apiKey = "DEMO_KEY"
	}
	return &Weather{db: db, key: apiKey, client: &http.Client{Timeout: 12 * time.Second}}
}

// Get returns the cached report, refreshing it from DONKI when older than 30 minutes.
// If DONKI is down or rate limited, the last good report is served marked as stale.
func (w *Weather) Get(ctx context.Context) (*Report, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	cached, at, err := w.cached(ctx)
	if err == nil && time.Since(at) < cacheTTL {
		return cached, nil
	}
	fresh, ferr := w.fetch(ctx)
	if ferr == nil {
		payload, _ := json.Marshal(fresh)
		if _, err := w.db.Exec(ctx, `INSERT INTO external_cache (key, payload, fetched_at) VALUES ($1, $2, now())
			ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at`, cacheKey, payload); err != nil {
			slog.Warn("cache space weather", "err", err)
		}
		return fresh, nil
	}
	slog.Warn("DONKI unavailable", "err", ferr)
	if cached != nil {
		cached.Stale = true
		return cached, nil
	}
	return nil, ferr
}

func (w *Weather) cached(ctx context.Context) (*Report, time.Time, error) {
	var payload []byte
	var at time.Time
	err := w.db.QueryRow(ctx, `SELECT payload, fetched_at FROM external_cache WHERE key = $1`, cacheKey).Scan(&payload, &at)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, time.Time{}, err
		}
		return nil, time.Time{}, err
	}
	var r Report
	if err := json.Unmarshal(payload, &r); err != nil {
		return nil, time.Time{}, err
	}
	return &r, at, nil
}

type donkiEvent struct {
	SepID       string `json:"sepID"`
	FlrID       string `json:"flrID"`
	EventTime   string `json:"eventTime"`
	PeakTime    string `json:"peakTime"`
	ClassType   string `json:"classType"`
	Link        string `json:"link"`
	Instruments []struct {
		DisplayName string `json:"displayName"`
	} `json:"instruments"`
}

// query asks DONKI for one event type. A 404 or empty body means "no events in the window".
func (w *Weather) query(ctx context.Context, kind string, days int) ([]donkiEvent, error) {
	end := time.Now().UTC()
	start := end.AddDate(0, 0, -days)
	url := fmt.Sprintf("%s/%s?startDate=%s&endDate=%s&api_key=%s", donki, kind, start.Format("2006-01-02"), end.Format("2006-01-02"), w.key)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	res, err := w.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("DONKI %s: %d", kind, res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(string(body)) == "" {
		return nil, nil
	}
	var out []donkiEvent
	return out, json.Unmarshal(body, &out)
}

func (w *Weather) fetch(ctx context.Context) (*Report, error) {
	// DONKI limits each query to 60 days.
	sep, err := w.query(ctx, "SEP", 59)
	if err != nil {
		return nil, err
	}
	flr, err := w.query(ctx, "FLR", 14)
	if err != nil {
		return nil, err
	}
	r := &Report{Source: "NASA DONKI (CCMC)", FetchedAt: time.Now().UTC().Format(time.RFC3339), SEP: []SEP{}, Flares: []Flare{}}
	for _, e := range sep {
		s := SEP{ID: e.SepID, Time: e.EventTime, Link: e.Link}
		if len(e.Instruments) > 0 {
			s.Instrument = e.Instruments[0].DisplayName
		}
		r.SEP = append(r.SEP, s)
	}
	for _, e := range flr {
		r.Flares = append(r.Flares, Flare{ID: e.FlrID, Time: e.PeakTime, ClassType: e.ClassType, Link: e.Link})
	}
	sort.Slice(r.SEP, func(i, j int) bool { return r.SEP[i].Time > r.SEP[j].Time })
	sort.Slice(r.Flares, func(i, j int) bool { return r.Flares[i].Time > r.Flares[j].Time })
	return r, nil
}

// RecordSolarFeed writes today's solar particle event count as a "feed" reading for every crew member
// of every active mission, so the immune system state and alerts use live NASA data.
func (w *Weather) RecordSolarFeed(ctx context.Context) error {
	r, err := w.Get(ctx)
	if err != nil {
		return err
	}
	n := float64(r.RecentSEP(time.Now().UTC()))
	_, err = w.db.Exec(ctx, `
		INSERT INTO readings (user_id, mission_id, day, indicator_id, value, source)
		SELECT mm.user_id, m.id, (current_date - m.start_date) + 1, 'solar', ARRAY[$1::double precision], 'feed'
		FROM missions m
		JOIN mission_members mm ON mm.mission_id = m.id
		JOIN users u ON u.id = mm.user_id AND u.role IN ('astronaut', 'crew_medical_officer')
		WHERE current_date >= m.start_date AND current_date < m.start_date + m.planned_days
		ON CONFLICT (user_id, mission_id, day, indicator_id)
		DO UPDATE SET value = EXCLUDED.value, source = 'feed', recorded_at = now()`, n)
	return err
}

// Run refreshes the feed every 30 minutes until ctx is done.
func (w *Weather) Run(ctx context.Context) {
	tick := time.NewTicker(cacheTTL)
	defer tick.Stop()
	for {
		if err := w.RecordSolarFeed(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("solar feed", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}
