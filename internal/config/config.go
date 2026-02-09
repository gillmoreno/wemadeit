package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// ProviderType represents the LLM provider used by the optional AI features.
// Keeping this in the core config mirrors the TimeManage architecture so the
// web UI can offer provider settings even if AI endpoints are added later.
type ProviderType string

const (
	ProviderOpenAI    ProviderType = "openai"
	ProviderAnthropic ProviderType = "anthropic"
	ProviderOllama    ProviderType = "ollama"
)

type Settings struct {
	Theme                       string       `json:"theme"`
	Provider                    ProviderType `json:"provider"`
	OpenAIKey                   string       `json:"openai_key"`
	AnthropicKey                string       `json:"anthropic_key"`
	OllamaBaseURL               string       `json:"ollama_base_url"`
	Model                       string       `json:"model"`
	MaxTokens                   int          `json:"max_tokens"`
	Temperature                 float64      `json:"temperature"`
	Verbose                     bool         `json:"verbose"`
	UseANSI                     bool         `json:"use_ansi"`
	AutoSummary                 bool         `json:"auto_summary"`
	OllamaHeaderTimeoutSeconds  int          `json:"ollama_header_timeout_seconds"`
	OllamaOverallTimeoutSeconds int          `json:"ollama_overall_timeout_seconds"`
	OllamaMaxAttempts           int          `json:"ollama_max_attempts"`
	OllamaBackoffBaseMs         int          `json:"ollama_backoff_base_ms"`
}

func DefaultSettings() Settings {
	return Settings{
		Theme:                       "sand",
		Provider:                    ProviderOpenAI,
		OpenAIKey:                   "",
		AnthropicKey:                "",
		OllamaBaseURL:               "http://localhost:11434",
		Model:                       "gpt-4o-mini",
		MaxTokens:                   400,
		Temperature:                 0.4,
		Verbose:                     false,
		UseANSI:                     true,
		AutoSummary:                 true,
		OllamaHeaderTimeoutSeconds:  10,
		OllamaOverallTimeoutSeconds: 180,
		OllamaMaxAttempts:           5,
		OllamaBackoffBaseMs:         0,
	}
}

func NormalizeTheme(v string) string {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "sand", "ocean", "forest", "graphite", "rose":
		return strings.ToLower(strings.TrimSpace(v))
	default:
		return "sand"
	}
}

func Load(path string) (Settings, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return DefaultSettings(), nil
		}
		return Settings{}, err
	}

	// We need to know whether certain optional booleans were present in the file
	// (so zero-values can be defaulted safely).
	var raw map[string]json.RawMessage
	_ = json.Unmarshal(data, &raw)

	var cfg Settings
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Settings{}, err
	}

	cfg.Theme = NormalizeTheme(cfg.Theme)
	if cfg.Provider == "" {
		cfg.Provider = ProviderOpenAI
	}
	if cfg.OllamaBaseURL == "" {
		cfg.OllamaBaseURL = "http://localhost:11434"
	}
	if cfg.Model == "" {
		cfg.Model = DefaultSettings().Model
	}
	if cfg.MaxTokens == 0 {
		cfg.MaxTokens = DefaultSettings().MaxTokens
	}
	if cfg.Temperature == 0 {
		cfg.Temperature = DefaultSettings().Temperature
	}
	if _, ok := raw["use_ansi"]; !ok {
		cfg.UseANSI = DefaultSettings().UseANSI
	}
	if _, ok := raw["auto_summary"]; !ok {
		cfg.AutoSummary = DefaultSettings().AutoSummary
	}
	if cfg.OllamaHeaderTimeoutSeconds == 0 {
		cfg.OllamaHeaderTimeoutSeconds = DefaultSettings().OllamaHeaderTimeoutSeconds
	}
	if cfg.OllamaOverallTimeoutSeconds == 0 {
		cfg.OllamaOverallTimeoutSeconds = DefaultSettings().OllamaOverallTimeoutSeconds
	}
	if cfg.OllamaMaxAttempts == 0 {
		cfg.OllamaMaxAttempts = DefaultSettings().OllamaMaxAttempts
	}
	if cfg.OllamaBackoffBaseMs == 0 {
		cfg.OllamaBackoffBaseMs = DefaultSettings().OllamaBackoffBaseMs
	}

	// Cloud-backed Ollama models can be significantly slower (cold starts, network latency).
	// Avoid brittle timeouts when using them.
	if cfg.Provider == ProviderOllama && strings.Contains(cfg.Model, ":cloud") {
		if cfg.OllamaHeaderTimeoutSeconds < 15 {
			cfg.OllamaHeaderTimeoutSeconds = 15
		}
		if cfg.OllamaOverallTimeoutSeconds < 180 {
			cfg.OllamaOverallTimeoutSeconds = 180
		}
	}

	return cfg, nil
}

func Save(path string, cfg Settings) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
