package health

import "time"

type Status string

const (
	Normal Status = "normal"
	Watch  Status = "watch"
	Alert  Status = "alert"
)

var rank = map[Status]int{Normal: 0, Watch: 1, Alert: 2}

type Assessment struct {
	Status    Status `json:"status"`
	Direction string `json:"direction,omitempty"` // "low" | "high"
}

func band(v float64, b Band) Assessment {
	switch {
	case v < b.AlertLow:
		return Assessment{Alert, "low"}
	case v > b.AlertHigh:
		return Assessment{Alert, "high"}
	case v < b.WatchLow:
		return Assessment{Watch, "low"}
	case v > b.WatchHigh:
		return Assessment{Watch, "high"}
	}
	return Assessment{Status: Normal}
}

// Assess reads a value against the indicator's bands; the worst band wins (blood pressure has two).
func (i *Indicator) Assess(value []float64) Assessment {
	out := Assessment{Status: Normal}
	for k, b := range i.Bands {
		if k >= len(value) {
			break
		}
		if a := band(value[k], b); rank[a.Status] > rank[out.Status] {
			out = a
		}
	}
	return out
}

// Valid reports whether every value is inside the indicator's input limits.
func (i *Indicator) Valid(value []float64) bool {
	want := 1
	if i.Input == "bp" {
		want = 2
	}
	if len(value) != want {
		return false
	}
	for _, v := range value {
		if v < i.Min || v > i.Max {
			return false
		}
	}
	return true
}

// TierFor says who should act: the astronaut ("self"), the crew, or the flight surgeon on the ground.
func TierFor(status Status, alertStreak int) string {
	switch status {
	case Normal:
		return "none"
	case Watch:
		return "self"
	}
	if alertStreak >= 2 {
		return "surgeon"
	}
	return "crew"
}

var tierRank = map[string]int{"none": 0, "self": 1, "crew": 2, "surgeon": 3}

// Log holds readings per mission day.
type Log map[int]map[string][]float64

func (l Log) Set(day int, indicator string, value []float64) {
	if l[day] == nil {
		l[day] = map[string][]float64{}
	}
	l[day][indicator] = value
}

// Latest is the most recent reading at or before day.
func (l Log) Latest(indicator string, day int) ([]float64, int) {
	for d := day; d >= 1; d-- {
		if v, ok := l[d][indicator]; ok {
			return v, d
		}
	}
	return nil, 0
}

// AlertStreak counts consecutive alert readings ending at the latest reading.
func (l Log) AlertStreak(i *Indicator, day int) int {
	count := 0
	for d := day; d >= 1; d-- {
		v, ok := l[d][i.ID]
		if !ok {
			if count == 0 {
				continue
			}
			break
		}
		if i.Assess(v).Status != Alert {
			break
		}
		count++
	}
	return count
}

type GroupState struct {
	Status Status `json:"status"`
	Tier   string `json:"tier"`
}

// GroupStates is the worst status and escalation tier of each body system on a given day.
func (c *Catalog) GroupStates(l Log, day int) map[string]GroupState {
	out := map[string]GroupState{}
	for _, g := range c.Groups {
		s := GroupState{Status: Normal, Tier: "none"}
		for _, i := range c.IndicatorsOf(g.ID) {
			v, _ := l.Latest(i.ID, day)
			if v == nil {
				continue
			}
			a := i.Assess(v)
			if rank[a.Status] > rank[s.Status] {
				s.Status = a.Status
			}
			if t := TierFor(a.Status, l.AlertStreak(i, day)); tierRank[t] > tierRank[s.Tier] {
				s.Tier = t
			}
		}
		out[g.ID] = s
	}
	return out
}

// MissionDay is the 1-based day of a mission that started on start (UTC calendar days).
func MissionDay(start, now time.Time) int {
	s := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, time.UTC)
	n := time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
	d := int(n.Sub(s).Hours()/24) + 1
	if d < 1 {
		return 1
	}
	return d
}
