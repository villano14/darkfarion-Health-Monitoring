// Package health holds the health catalog (loaded from the database) and the rules that read it:
// how a reading is assessed, which escalation tier it needs and the state of each body system.
package health

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Band struct {
	AlertLow  float64 `json:"alertLow"`
	WatchLow  float64 `json:"watchLow"`
	WatchHigh float64 `json:"watchHigh"`
	AlertHigh float64 `json:"alertHigh"`
}

type IndicatorText struct {
	Label   string              `json:"label"`
	Unit    *string             `json:"unit,omitempty"`
	How     string              `json:"how"`
	Device  string              `json:"device"`
	Why     string              `json:"why"`
	Space   string              `json:"space"`
	Source  string              `json:"source"`
	Steps   []string            `json:"steps"`
	Actions map[string][]string `json:"actions"`
	Risks   map[string]string   `json:"risks"`
}

type Indicator struct {
	ID     string                   `json:"id"`
	Group  string                   `json:"group"`
	Unit   string                   `json:"unit"`
	Input  string                   `json:"input"`
	Min    float64                  `json:"min"`
	Max    float64                  `json:"max"`
	Step   float64                  `json:"step"`
	Range  string                   `json:"range"`
	Normal [2]float64               `json:"normal"`
	Bands  []Band                   `json:"bands"`
	Text   map[string]IndicatorText `json:"text"`
}

type NameRole struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

type Group struct {
	ID      string              `json:"id"`
	Systems []string            `json:"systems"`
	Context []string            `json:"context"`
	Hazards []string            `json:"hazards"`
	Text    map[string]NameRole `json:"text"`
}

type Environment struct {
	ID         string            `json:"id"`
	Gravity    string            `json:"gravity"`
	Delay      string            `json:"delay"`
	Unloading  float64           `json:"unloading"`
	Dose       float64           `json:"dose"`
	Autonomous bool              `json:"autonomous"`
	Name       map[string]string `json:"name"`
}

type Hazard struct {
	ID   string            `json:"id"`
	Name map[string]string `json:"name"`
}

type LabelRule struct {
	Label string `json:"label"`
	Rule  string `json:"rule"`
}

type Tier struct {
	ID   string               `json:"id"`
	Text map[string]LabelRule `json:"text"`
}

type Task struct {
	ID         string            `json:"id"`
	Time       string            `json:"time"`
	Kind       string            `json:"kind"`
	Indicators []string          `json:"indicators"`
	Points     int               `json:"points"`
	Label      map[string]string `json:"label"`
}

type NameDescription struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Achievement struct {
	ID     string                     `json:"id"`
	Icon   string                     `json:"icon"`
	Points int                        `json:"points"`
	Text   map[string]NameDescription `json:"text"`
}

// Catalog is everything the app knows about measuring health, in every language.
type Catalog struct {
	Indicators   []*Indicator   `json:"indicators"`
	Groups       []*Group       `json:"groups"`
	Environments []*Environment `json:"environments"`
	Hazards      []*Hazard      `json:"hazards"`
	Tiers        []*Tier        `json:"tiers"`
	Tasks        []*Task        `json:"tasks"`
	Achievements []*Achievement `json:"achievements"`

	indicator   map[string]*Indicator
	environment map[string]*Environment
	task        map[string]*Task
}

func (c *Catalog) Indicator(id string) *Indicator     { return c.indicator[id] }
func (c *Catalog) Environment(id string) *Environment { return c.environment[id] }
func (c *Catalog) Task(id string) *Task               { return c.task[id] }

// IndicatorsOf lists a body group's indicators in catalog order.
func (c *Catalog) IndicatorsOf(group string) []*Indicator {
	var out []*Indicator
	for _, i := range c.Indicators {
		if i.Group == group {
			out = append(out, i)
		}
	}
	return out
}

// Daily lists the indicators the astronaut logs every day (everything not read by onboard equipment).
func (c *Catalog) Daily() []*Indicator {
	var out []*Indicator
	for _, i := range c.Indicators {
		if i.Input != "scan" {
			out = append(out, i)
		}
	}
	return out
}

// LoadCatalog reads the whole catalog. It is small and changes only with migrations, so it is loaded once.
func LoadCatalog(ctx context.Context, pool *pgxpool.Pool) (*Catalog, error) {
	c := &Catalog{indicator: map[string]*Indicator{}, environment: map[string]*Environment{}, task: map[string]*Task{}}

	rows, err := pool.Query(ctx, `SELECT id, group_id, unit, input, min_value, max_value, step, range_text, normal_low, normal_high, bands FROM indicators ORDER BY sort`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		i := &Indicator{Text: map[string]IndicatorText{}}
		var bands []byte
		if err := rows.Scan(&i.ID, &i.Group, &i.Unit, &i.Input, &i.Min, &i.Max, &i.Step, &i.Range, &i.Normal[0], &i.Normal[1], &bands); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(bands, &i.Bands); err != nil {
			return nil, fmt.Errorf("indicator %s bands: %w", i.ID, err)
		}
		c.Indicators = append(c.Indicators, i)
		c.indicator[i.ID] = i
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = pool.Query(ctx, `SELECT indicator_id, lang, label, unit, how, device, why, space, source, steps, actions, risks FROM indicator_i18n`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id, lang string
		var t IndicatorText
		var steps, actions, risks []byte
		if err := rows.Scan(&id, &lang, &t.Label, &t.Unit, &t.How, &t.Device, &t.Why, &t.Space, &t.Source, &steps, &actions, &risks); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(steps, &t.Steps); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(actions, &t.Actions); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(risks, &t.Risks); err != nil {
			return nil, err
		}
		if i := c.indicator[id]; i != nil {
			i.Text[lang] = t
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	groups := map[string]*Group{}
	rows, err = pool.Query(ctx, `SELECT id, systems, context, hazards FROM body_groups ORDER BY sort`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		g := &Group{Text: map[string]NameRole{}}
		if err := rows.Scan(&g.ID, &g.Systems, &g.Context, &g.Hazards); err != nil {
			return nil, err
		}
		c.Groups = append(c.Groups, g)
		groups[g.ID] = g
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT group_id, lang, name, role FROM body_group_i18n`, func(id, lang string, v []string) {
		if g := groups[id]; g != nil {
			g.Text[lang] = NameRole{v[0], v[1]}
		}
	}); err != nil {
		return nil, err
	}

	rows, err = pool.Query(ctx, `SELECT id, gravity, delay, unloading, dose, autonomous FROM environments ORDER BY sort`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		e := &Environment{Name: map[string]string{}}
		if err := rows.Scan(&e.ID, &e.Gravity, &e.Delay, &e.Unloading, &e.Dose, &e.Autonomous); err != nil {
			return nil, err
		}
		c.Environments = append(c.Environments, e)
		c.environment[e.ID] = e
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT environment_id, lang, name FROM environment_i18n`, func(id, lang string, v []string) {
		if e := c.environment[id]; e != nil {
			e.Name[lang] = v[0]
		}
	}); err != nil {
		return nil, err
	}

	hazards := map[string]*Hazard{}
	if err := eachText(ctx, pool, `SELECT id, '' AS lang FROM hazards ORDER BY sort`, func(id, _ string, _ []string) {
		h := &Hazard{ID: id, Name: map[string]string{}}
		c.Hazards = append(c.Hazards, h)
		hazards[id] = h
	}); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT hazard_id, lang, name FROM hazard_i18n`, func(id, lang string, v []string) {
		if h := hazards[id]; h != nil {
			h.Name[lang] = v[0]
		}
	}); err != nil {
		return nil, err
	}

	tiers := map[string]*Tier{}
	if err := eachText(ctx, pool, `SELECT id, '' AS lang FROM tiers ORDER BY sort`, func(id, _ string, _ []string) {
		t := &Tier{ID: id, Text: map[string]LabelRule{}}
		c.Tiers = append(c.Tiers, t)
		tiers[id] = t
	}); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT tier_id, lang, label, rule FROM tier_i18n`, func(id, lang string, v []string) {
		if t := tiers[id]; t != nil {
			t.Text[lang] = LabelRule{v[0], v[1]}
		}
	}); err != nil {
		return nil, err
	}

	rows, err = pool.Query(ctx, `SELECT id, time_of_day, kind, indicators, points FROM routine_tasks ORDER BY sort`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		t := &Task{Label: map[string]string{}}
		if err := rows.Scan(&t.ID, &t.Time, &t.Kind, &t.Indicators, &t.Points); err != nil {
			return nil, err
		}
		c.Tasks = append(c.Tasks, t)
		c.task[t.ID] = t
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT task_id, lang, label FROM routine_task_i18n`, func(id, lang string, v []string) {
		if t := c.task[id]; t != nil {
			t.Label[lang] = v[0]
		}
	}); err != nil {
		return nil, err
	}

	achievements := map[string]*Achievement{}
	rows, err = pool.Query(ctx, `SELECT id, icon, points FROM achievements ORDER BY sort`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		a := &Achievement{Text: map[string]NameDescription{}}
		if err := rows.Scan(&a.ID, &a.Icon, &a.Points); err != nil {
			return nil, err
		}
		c.Achievements = append(c.Achievements, a)
		achievements[a.ID] = a
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := eachText(ctx, pool, `SELECT achievement_id, lang, name, description FROM achievement_i18n`, func(id, lang string, v []string) {
		if a := achievements[id]; a != nil {
			a.Text[lang] = NameDescription{v[0], v[1]}
		}
	}); err != nil {
		return nil, err
	}

	if len(c.Indicators) == 0 {
		return nil, fmt.Errorf("catalog is empty: migrations did not run")
	}
	return c, nil
}

// eachText runs a query whose columns are (id, lang, text...) and hands each row to fn.
func eachText(ctx context.Context, pool *pgxpool.Pool, query string, fn func(id, lang string, values []string)) error {
	rows, err := pool.Query(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()
	n := len(rows.FieldDescriptions())
	for rows.Next() {
		vals := make([]string, n)
		ptrs := make([]any, n)
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return err
		}
		fn(vals[0], vals[1], vals[2:])
	}
	return rows.Err()
}
