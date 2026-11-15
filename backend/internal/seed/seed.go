// Package seed creates a demo mission when the database has no real people yet (SEED_DEMO=true).
//
// Where NASA has public astronaut data we use it: each demo astronaut is paired with one anonymized
// SpaceX Inspiration4 crew member from NASA OSDR OSD-575, and their blood panel (glucose, calcium,
// creatinine) starts from that person's real preflight values. NASA does not publish day-by-day
// vitals, sleep or mood of astronauts, so those are generated (source = "seed") with a fixed random
// seed, following the trends described by the NASA Human Research Program.
package seed

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"math/rand/v2"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"crewhealth/backend/internal/health"
	"crewhealth/backend/internal/httpapi"
)

const (
	Domain      = "crewhealth.demo"
	missionDay  = 87  // the demo opens on this mission day
	plannedDays = 180 // six-month expedition
)

type person struct {
	name, email, role, title, osdr string
}

var people = []person{
	{"Ana Rivera", "ana.rivera", httpapi.RoleAstronaut, "Flight engineer", "C001"},
	{"Marcus Chen", "marcus.chen", httpapi.RoleAstronaut, "Commander", "C002"},
	{"Sofía Okafor", "sofia.okafor", httpapi.RoleCMO, "Crew medical officer", "C003"},
	{"Leo Haddad", "leo.haddad", httpapi.RoleAstronaut, "Mission specialist", "C004"},
	{"Dra. Julia Park", "julia.park", httpapi.RoleSurgeon, "Flight surgeon", ""},
	{"Control de misión", "control", httpapi.RoleAdmin, "", ""},
}

// Accounts lists the demo logins shown on the sign-in screen.
func Accounts(password string) []httpapi.DemoAccount {
	out := make([]httpapi.DemoAccount, 0, len(people))
	for _, p := range people {
		out = append(out, httpapi.DemoAccount{Email: p.email + "@" + Domain, Name: p.name, Role: p.role, Password: password})
	}
	return out
}

// Run seeds the demo mission. mode "true" seeds only an empty database; "reset" deletes the previous
// demo people and mission first, so the demo always opens on day 87.
func Run(ctx context.Context, db *pgxpool.Pool, c *health.Catalog, mode, password string) error {
	if mode == "reset" {
		if _, err := db.Exec(ctx, `DELETE FROM missions WHERE id IN (SELECT mm.mission_id FROM mission_members mm JOIN users u ON u.id = mm.user_id WHERE u.email LIKE '%@`+Domain+`')`); err != nil {
			return err
		}
		if _, err := db.Exec(ctx, `DELETE FROM users WHERE email LIKE '%@`+Domain+`'`); err != nil {
			return err
		}
	}
	var users int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&users); err != nil {
		return err
	}
	if users > 0 {
		slog.Info("demo seed skipped: database already has users")
		return nil
	}
	hash, err := httpapi.HashPassword(password)
	if err != nil {
		return err
	}
	baselines, err := osdrBaselines(ctx, db)
	if err != nil {
		return err
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	start := time.Now().UTC().AddDate(0, 0, -(missionDay - 1))
	var missionID int64
	if err := tx.QueryRow(ctx, `INSERT INTO missions (name, environment_id, start_date, planned_days) VALUES ('Expedition 7', 'iss', $1, $2) RETURNING id`,
		start.Format("2006-01-02"), plannedDays).Scan(&missionID); err != nil {
		return err
	}
	ids := map[string]int64{}
	for _, p := range people {
		var id int64
		initials := ""
		for _, f := range strings.Fields(strings.TrimPrefix(p.name, "Dra. ")) {
			if len(initials) < 2 {
				initials += strings.ToUpper(string([]rune(f)[0]))
			}
		}
		if err := tx.QueryRow(ctx, `INSERT INTO users (email, password_hash, name, initials, role) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			p.email+"@"+Domain, hash, p.name, initials, p.role).Scan(&id); err != nil {
			return err
		}
		ids[p.email] = id
		if p.role != httpapi.RoleAdmin {
			if _, err := tx.Exec(ctx, `INSERT INTO mission_members (mission_id, user_id, title) VALUES ($1, $2, $3)`, missionID, id, p.title); err != nil {
				return err
			}
		}
	}

	env := c.Environment("iss")
	logs := map[string]health.Log{}
	var readingRows, taskRows [][]any
	for k, p := range people {
		if p.osdr == "" {
			continue
		}
		rng := rand.New(rand.NewPCG(42, uint64(k+1)))
		log, exercise := history(p, baselines[p.osdr], env, rng)
		logs[p.email] = log
		for day, values := range log {
			for ind, v := range values {
				src := "seed"
				if ind == "calcium" || ind == "creatinine" || ind == "bone" || ind == "muscle" || ind == "radiation" {
					src = "scan"
				}
				readingRows = append(readingRows, []any{ids[p.email], missionID, day, ind, v, src})
			}
		}
		for day, tasks := range exercise {
			for _, t := range tasks {
				taskRows = append(taskRows, []any{ids[p.email], missionID, day, t})
			}
		}
	}
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"readings"}, []string{"user_id", "mission_id", "day", "indicator_id", "value", "source"}, pgx.CopyFromRows(readingRows)); err != nil {
		return fmt.Errorf("copy readings: %w", err)
	}
	if _, err := tx.CopyFrom(ctx, pgx.Identifier{"task_completions"}, []string{"user_id", "mission_id", "day", "task_id"}, pgx.CopyFromRows(taskRows)); err != nil {
		return fmt.Errorf("copy tasks: %w", err)
	}
	// Alerts for the last days, as the server would have raised them.
	for email, log := range logs {
		for d := missionDay - 2; d <= missionDay; d++ {
			if err := httpapi.RaiseAlerts(ctx, tx, c, log, ids[email], missionID, d); err != nil {
				return err
			}
		}
	}
	// The crew medical officer already looked at yesterday's blood pressure alert.
	if _, err := tx.Exec(ctx, `
		INSERT INTO alert_notes (alert_id, author_id, body)
		SELECT id, $1, 'Rechequeado en ambos brazos: 141/90. Reducir sodio y repetir mañana en ayunas.'
		FROM alerts WHERE user_id = $2 AND indicator_id = 'bp' AND day = $3`, ids["sofia.okafor"], ids["ana.rivera"], missionDay-1); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	slog.Info("demo mission seeded", "mission", "Expedition 7", "day", missionDay, "readings", len(readingRows))
	return nil
}

type panel struct{ glucose, calcium, creatinine float64 }

// osdrBaselines averages each Inspiration4 crew member's preflight blood panel (L-92, L-44, L-3).
func osdrBaselines(ctx context.Context, db *pgxpool.Pool) (map[string]panel, error) {
	rows, err := db.Query(ctx, `
		SELECT crew, avg(glucose), avg(calcium), avg(creatinine)
		FROM osdr_cmp_samples WHERE dataset_id = 'OSD-575' AND timepoint LIKE 'L-%' GROUP BY crew`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]panel{}
	for rows.Next() {
		var crew string
		var p panel
		if err := rows.Scan(&crew, &p.glucose, &p.calcium, &p.creatinine); err != nil {
			return nil, err
		}
		out[crew] = p
	}
	return out, rows.Err()
}

// round keeps n decimals without binary noise (2.3, not 2.3000000000000003).
func round(v float64, n int) float64 {
	p := math.Pow(10, float64(n))
	return math.Round(v*p) / p
}

// history builds one astronaut's mission so far. Each person carries a different story so the
// crew view shows every escalation tier.
func history(p person, base panel, env *health.Environment, rng *rand.Rand) (health.Log, map[int][]string) {
	n := func() float64 { return rng.Float64() - 0.5 }
	log := health.Log{}
	exercise := map[int][]string{}
	dose := 0.0
	for d := 1; d <= missionDay; d++ {
		t := float64(d) / missionDay
		// Daily check-in: until yesterday for everyone; today depends on the person.
		skipped := p.osdr != "C003" && rng.Float64() < 0.04 && d < missionDay-16
		if d < missionDay && !skipped {
			sys, dia := 114+4*t+n()*6, 73+3*t+n()*4
			sleep := 7.3 - 0.3*t + n()*0.9
			water := 2.7 + n()*0.8
			switch p.osdr {
			case "C001": // blood pressure creeping up with the fluid shift
				sys, dia = 116+22*math.Pow(t, 3)+n()*6, 74+14*math.Pow(t, 3)+n()*4
			case "C002": // commander sleeping less as the workload grows
				sleep = 7.4 - 1.2*t + n()*0.8
			case "C004": // drinks too little
				water = 2.4 - 0.4*t + n()*0.5
			}
			log.Set(d, "bp", []float64{math.Round(sys), math.Round(dia)})
			log.Set(d, "hr", []float64{math.Round(66 + 4*math.Sin(float64(d)/9) + n()*6)})
			log.Set(d, "glucose", []float64{math.Round(base.glucose + 6*t + n()*9)})
			log.Set(d, "temp", []float64{round(36.8+n()*0.3, 1)})
			log.Set(d, "water", []float64{round(math.Max(0.8, water), 1)})
			log.Set(d, "sleep", []float64{math.Round(math.Max(3, sleep)*2) / 2})
			log.Set(d, "mood", []float64{math.Max(1, math.Min(5, math.Round(4.4-0.5*t+n()*1.4)))})
		}
		if d < missionDay && rng.Float64() < 0.9 {
			exercise[d] = append(exercise[d], "ared")
		}
		if d < missionDay && rng.Float64() < 0.85 {
			exercise[d] = append(exercise[d], "cycle")
		}
		// Onboard equipment, every day up to today.
		dose += env.Dose * (1 + n()*0.3)
		log.Set(d, "radiation", []float64{round(dose, 1)})
		log.Set(d, "bone", []float64{round(-0.8*env.Unloading*(float64(d)/30)+n()*0.15, 1)})
		log.Set(d, "muscle", []float64{round(-0.045*env.Unloading*float64(d)+n()*0.4, 1)})
		log.Set(d, "solar", []float64{0})
		// Weekly blood panel from the handheld analyzer, starting at the person's real preflight values.
		if d%7 == 3 || d == missionDay {
			drift := 0.3
			if p.osdr == "C004" {
				drift = 0.6 // low fluids plus bone unloading
			}
			log.Set(d, "calcium", []float64{round(base.calcium+drift*t*env.Unloading+n()*0.2, 1)})
			log.Set(d, "creatinine", []float64{round(base.creatinine+0.08*t+n()*0.08, 2)})
		}
	}
	y := missionDay - 1
	switch p.osdr {
	case "C001": // two days in a row above 139/89: the flight surgeon must review
		log.Set(y-1, "bp", []float64{141, 90})
		log.Set(y, "bp", []float64{142, 91})
		log.Set(y, "hr", []float64{74})
		log.Set(y, "sleep", []float64{6.5})
		log.Set(y, "mood", []float64{4})
		// Rivera has not done today's check-in yet; her streak broke two weeks ago.
		delete(log[missionDay-15], "mood")
	case "C002": // short night today: crew-level alert
		log.Set(y, "sleep", []float64{6.5})
		log.Set(missionDay, "sleep", []float64{5.5})
		log.Set(missionDay, "bp", []float64{121, 78})
		log.Set(missionDay, "hr", []float64{68})
		log.Set(missionDay, "glucose", []float64{math.Round(base.glucose + 4)})
	case "C003": // the crew medical officer has finished today's check-in and workout
		log.Set(missionDay, "bp", []float64{117, 75})
		log.Set(missionDay, "hr", []float64{62})
		log.Set(missionDay, "glucose", []float64{math.Round(base.glucose)})
		log.Set(missionDay, "temp", []float64{36.7})
		log.Set(missionDay, "water", []float64{2.9})
		log.Set(missionDay, "sleep", []float64{7.5})
		log.Set(missionDay, "mood", []float64{5})
		exercise[missionDay] = []string{"ared", "cycle"}
	case "C004":
		log.Set(y, "water", []float64{1.8})
		log.Set(missionDay, "sleep", []float64{7})
		log.Set(missionDay, "water", []float64{1.4})
	}
	return log, exercise
}
