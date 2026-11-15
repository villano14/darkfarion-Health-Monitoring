// Package chat streams Orbi's answers from Groq (OpenAI-compatible API). The key stays on the server.
package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	endpoint = "https://api.groq.com/openai/v1/chat/completions"
	Model    = "openai/gpt-oss-120b"
)

// System is Orbi's fixed system prompt. Per-request health data goes in the user turn, never here.
const System = `You are Orbi, the friendly health companion inside CrewHealth, an app that helps astronauts on long-duration missions monitor their own health.

What you do:
- Explain the crew member's current readings and risks in plain words, using the <crew_health_context> they send.
- Give practical, step-by-step self-care and prevention advice that works in space: exercise countermeasures (resistance device, cycle ergometer, treadmill), hydration, sleep hygiene under artificial light cycles, nutrition, stress and isolation coping.
- Explain how spaceflight hazards (radiation, isolation and confinement, distance from Earth, altered gravity, closed environment) affect the body.
- Medications: you may explain, in general terms, which kinds of medicines are commonly carried in a spaceflight medical kit for a symptom (for example an antipyretic for fever, or an antiemetic for space motion sickness), what they are for, and common cautions. Do not give personalised doses or tell the person to start, stop, or change a prescription. Say that medication decisions go through the flight surgeon and the onboard medical checklist.

Safety:
- You are not a doctor and this is not a diagnosis. Keep that short; do not repeat it in every message.
- If readings or symptoms suggest an emergency (chest pain, fainting, severe breathing trouble, very high or very low blood pressure, confusion, temperature of 39 °C or more), tell them to stop, alert a crewmate now, and contact the flight surgeon, before anything else. On Mars-like delays, tell them to follow the emergency checklist first.
- Never invent readings. If the context does not contain something, say so and suggest measuring it.

Style:
- Reply in the language named in <language>.
- Be warm, calm and brief: two to five short sentences or a short numbered list. No headings, no tables, no emojis.
- Use the crew member's actual numbers when relevant.`

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Client struct {
	key  string
	http *http.Client
}

func New(apiKey string) *Client {
	return &Client{key: apiKey, http: &http.Client{Timeout: 2 * time.Minute}}
}

// ErrorCode classifies a failure for the frontend: auth, rate_limit, bad_request, connection, api.
type Error struct{ Code string }

func (e *Error) Error() string { return "chat: " + e.Code }

// Stream sends the conversation and calls onText for each answer fragment.
func (c *Client) Stream(ctx context.Context, messages []Message, onText func(string)) error {
	if c.key == "" {
		return &Error{"auth"}
	}
	body, _ := json.Marshal(map[string]any{
		"model":                 Model,
		"messages":              append([]Message{{Role: "system", Content: System}}, messages...),
		"temperature":           1,
		"top_p":                 1,
		"max_completion_tokens": 2048,
		"reasoning_effort":      "medium",
		"stream":                true,
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.key)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return &Error{"connection"}
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return &Error{"auth"}
	case res.StatusCode == http.StatusTooManyRequests:
		return &Error{"rate_limit"}
	case res.StatusCode == http.StatusBadRequest:
		return &Error{"bad_request"}
	case res.StatusCode != http.StatusOK:
		return &Error{"api"}
	}
	scanner := bufio.NewScanner(res.Body)
	scanner.Buffer(make([]byte, 64*1024), 1<<20)
	for scanner.Scan() {
		line, ok := strings.CutPrefix(scanner.Text(), "data: ")
		if !ok {
			continue
		}
		if line == "[DONE]" {
			return nil
		}
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(line), &chunk); err != nil {
			return fmt.Errorf("decode stream: %w", err)
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			onText(chunk.Choices[0].Delta.Content)
		}
	}
	if err := scanner.Err(); err != nil && !errors.Is(err, context.Canceled) {
		return &Error{"connection"}
	}
	return nil
}
