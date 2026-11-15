package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

const tokenTTL = 7 * 24 * time.Hour

var dummyHash = sync.OnceValue(func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("not-a-real-password"), bcrypt.DefaultCost)
	return h
})

type claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Server) issueToken(id int64, role string) (string, error) {
	now := time.Now()
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(id, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
			Issuer:    "crewhealth",
		},
	}).SignedString(s.cfg.JWTSecret)
}

func (s *Server) parseToken(raw string) (Viewer, error) {
	var c claims
	_, err := jwt.ParseWithClaims(raw, &c, func(t *jwt.Token) (any, error) { return s.cfg.JWTSecret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("crewhealth"), jwt.WithExpirationRequired())
	if err != nil {
		return Viewer{}, err
	}
	id, err := strconv.ParseInt(c.Subject, 10, 64)
	if err != nil {
		return Viewer{}, errors.New("bad subject")
	}
	return Viewer{ID: id, Role: c.Role}, nil
}

// HashPassword is shared with the seed and admin user creation.
func HashPassword(p string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	return string(b), err
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct{ Email, Password string }
	if err := readJSON(r, &body); err != nil || body.Email == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	var (
		id         int64
		hash, role string
	)
	err := s.db.QueryRow(r.Context(), `SELECT id, password_hash, role FROM users WHERE lower(email) = lower($1)`,
		strings.TrimSpace(body.Email)).Scan(&id, &hash, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		// Same work as a real check so timing does not reveal which emails exist.
		_ = bcrypt.CompareHashAndPassword(dummyHash(), []byte(body.Password))
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}
	if err != nil {
		s.fail(w, err)
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials")
		return
	}
	token, err := s.issueToken(id, role)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token})
}

// config tells the login screen whether demo accounts exist.
func (s *Server) config(w http.ResponseWriter, r *http.Request) {
	out := map[string]any{"demo": s.cfg.Demo}
	if s.cfg.Demo {
		out["demoAccounts"] = s.cfg.DemoAccounts
	}
	writeJSON(w, http.StatusOK, out)
}
