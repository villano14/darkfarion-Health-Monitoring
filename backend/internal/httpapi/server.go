// Package httpapi exposes the CrewHealth REST API.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crewhealth/backend/internal/chat"
	"crewhealth/backend/internal/health"
	"crewhealth/backend/internal/nasa"
)

type Config struct {
	JWTSecret    []byte
	CORSOrigins  []string
	Demo         bool
	DemoAccounts []DemoAccount
}

type DemoAccount struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Password string `json:"password"`
}

type Server struct {
	db      *pgxpool.Pool
	catalog *health.Catalog
	cfg     Config
	weather *nasa.Weather
	chat    *chat.Client
}

func New(db *pgxpool.Pool, catalog *health.Catalog, cfg Config, weather *nasa.Weather, chatClient *chat.Client) *Server {
	return &Server{db: db, catalog: catalog, cfg: cfg, weather: weather, chat: chatClient}
}

// Roles.
const (
	RoleAstronaut = "astronaut"
	RoleCMO       = "crew_medical_officer"
	RoleSurgeon   = "flight_surgeon"
	RoleAdmin     = "admin"
)

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	// Public
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]any{"ok": true}) })
	mux.HandleFunc("GET /api/config", s.config)
	mux.HandleFunc("POST /api/auth/login", s.login)

	// Any signed-in user
	auth := func(h http.HandlerFunc) http.Handler { return s.requireAuth(h) }
	mux.Handle("GET /api/me", auth(s.me))
	mux.Handle("GET /api/catalog", auth(s.getCatalog))
	mux.Handle("GET /api/readings", auth(s.listReadings))
	mux.Handle("POST /api/readings", auth(s.onlyRoles(s.createReadings, RoleAstronaut, RoleCMO)))
	mux.Handle("GET /api/routine", auth(s.routine))
	mux.Handle("POST /api/routine/{task}/toggle", auth(s.onlyRoles(s.toggleTask, RoleAstronaut, RoleCMO)))
	mux.Handle("GET /api/progress", auth(s.progress))
	mux.Handle("GET /api/report", auth(s.report))
	mux.Handle("GET /api/alerts", auth(s.listAlerts))
	mux.Handle("POST /api/alerts/{id}/notes", auth(s.addNote))
	mux.Handle("GET /api/space-weather", auth(s.spaceWeather))
	mux.Handle("GET /api/osdr/cmp", auth(s.osdrPanel))
	mux.Handle("POST /api/chat", auth(s.onlyRoles(s.chatHandler, RoleAstronaut, RoleCMO)))

	// Crew medical officer and flight surgeon
	mux.Handle("GET /api/crew", auth(s.onlyRoles(s.crew, RoleCMO, RoleSurgeon, RoleAdmin)))
	mux.Handle("POST /api/alerts/{id}/ack", auth(s.onlyRoles(s.ackAlert, RoleCMO, RoleSurgeon)))

	// Mission control
	mux.Handle("GET /api/admin/users", auth(s.onlyRoles(s.adminUsers, RoleAdmin)))
	mux.Handle("POST /api/admin/users", auth(s.onlyRoles(s.adminCreateUser, RoleAdmin)))
	mux.Handle("GET /api/admin/missions", auth(s.onlyRoles(s.adminMissions, RoleAdmin)))
	mux.Handle("POST /api/admin/missions", auth(s.onlyRoles(s.adminCreateMission, RoleAdmin)))
	mux.Handle("POST /api/admin/missions/{id}/members", auth(s.onlyRoles(s.adminAddMember, RoleAdmin)))

	return s.cors(logRequests(mux))
}

// --- Middleware ---------------------------------------------------------------

type ctxKey struct{}

// Viewer is the signed-in user making the request.
type Viewer struct {
	ID   int64
	Role string
}

func viewer(r *http.Request) Viewer { return r.Context().Value(ctxKey{}).(Viewer) }

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		v, err := s.parseToken(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, v)))
	})
}

func (s *Server) onlyRoles(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !slices.Contains(roles, viewer(r).Role) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		next(w, r)
	}
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (slices.Contains(s.cfg.CORSOrigins, "*") || slices.Contains(s.cfg.CORSOrigins, origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
	})
}

// --- Helpers ------------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

func readJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	return dec.Decode(v)
}

func (s *Server) fail(w http.ResponseWriter, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	slog.Error("request failed", "err", err)
	writeError(w, http.StatusInternalServerError, "internal")
}

func langOf(r *http.Request) string {
	if r.URL.Query().Get("lang") == "es" {
		return "es"
	}
	return "en"
}

func pathID(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	return id, err == nil && id > 0
}
