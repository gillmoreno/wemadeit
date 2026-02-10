package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"wemadeit/internal/auth"
	"wemadeit/internal/config"
	"wemadeit/internal/db"
	"wemadeit/internal/models"
)

type Server struct {
	store      *db.Store
	mu         sync.RWMutex
	settings   config.Settings
	configPath string
}

type ctxKey int

const ctxAuth ctxKey = iota

type authContext struct {
	Token string
	User  models.User
}

func New(store *db.Store, cfg config.Settings, configPath string) *Server {
	return &Server{
		store:      store,
		settings:   cfg,
		configPath: configPath,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)

	// Auth (required for all other endpoints).
	mux.HandleFunc("/api/login", s.handleLogin)

	mux.HandleFunc("/api/me", s.requireAuth(s.handleMe))
	mux.HandleFunc("/api/logout", s.requireAuth(s.handleLogout))

	mux.HandleFunc("/api/state", s.requireAuth(s.handleState))

	mux.HandleFunc("/api/organizations", s.requireAuth(s.handleOrganizations))
	mux.HandleFunc("/api/contacts", s.requireAuth(s.handleContacts))
	mux.HandleFunc("/api/deals", s.requireAuth(s.handleDeals))
	mux.HandleFunc("/api/payments", s.requireAuth(s.handlePayments))
	mux.HandleFunc("/api/pipelines", s.requireAuth(s.handlePipelines))
	mux.HandleFunc("/api/pipeline_stages", s.requireAuth(s.handlePipelineStages))
	mux.HandleFunc("/api/projects", s.requireAuth(s.handleProjects))
	mux.HandleFunc("/api/tasks", s.requireAuth(s.handleTasks))
	mux.HandleFunc("/api/users", s.requireAuth(s.handleUsers))
	mux.HandleFunc("/api/quotations", s.requireAuth(s.handleQuotations))
	mux.HandleFunc("/api/quotation_items", s.requireAuth(s.handleQuotationItems))
	mux.HandleFunc("/api/interactions", s.requireAuth(s.handleInteractions))

	mux.HandleFunc("/api/settings", s.requireAuth(s.handleSettings))
	return withCORS(mux)
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authCtx, ok, err := s.authenticate(r)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		if !ok {
			writeJSON(w, http.StatusUnauthorized, errorResponse("unauthorized"))
			return
		}
		ctx := context.WithValue(r.Context(), ctxAuth, authCtx)
		next(w, r.WithContext(ctx))
	}
}

func (s *Server) authenticate(r *http.Request) (authContext, bool, error) {
	token := bearerToken(r.Header.Get("Authorization"))
	if token == "" {
		return authContext{}, false, nil
	}

	sess, ok, err := s.store.LoadSession(token)
	if err != nil {
		return authContext{}, false, err
	}
	if !ok {
		return authContext{}, false, nil
	}
	if time.Now().After(sess.ExpiresAt) {
		_ = s.store.DeleteSession(token)
		return authContext{}, false, nil
	}

	user, ok, err := s.store.FindUserByID(sess.UserID)
	if err != nil {
		return authContext{}, false, err
	}
	if !ok {
		return authContext{}, false, nil
	}
	return authContext{Token: token, User: user}, true, nil
}

func mustAuth(r *http.Request) authContext {
	if v := r.Context().Value(ctxAuth); v != nil {
		if ac, ok := v.(authContext); ok {
			return ac
		}
	}
	return authContext{}
}

func bearerToken(header string) string {
	h := strings.TrimSpace(header)
	if h == "" {
		return ""
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(strings.TrimSpace(parts[0]), "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "app": "wemadeit"})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
		return
	}
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &payload); err != nil {
		writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
		return
	}

	email := strings.ToLower(strings.TrimSpace(payload.Email))
	if email == "" || strings.TrimSpace(payload.Password) == "" {
		writeJSON(w, http.StatusBadRequest, errorResponse("email and password are required"))
		return
	}

	user, ok, err := s.store.FindUserByEmail(email)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	if !ok {
		writeJSON(w, http.StatusUnauthorized, errorResponse("invalid credentials"))
		return
	}
	if err := auth.CheckPassword(user.PasswordHash, payload.Password); err != nil {
		writeJSON(w, http.StatusUnauthorized, errorResponse("invalid credentials"))
		return
	}

	token, err := auth.NewToken(32)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}

	now := time.Now()
	expiresAt := now.Add(7 * 24 * time.Hour)
	userAgent := r.UserAgent()
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.RemoteAddr
	}
	if err := s.store.SaveSession(token, user.ID, now, expiresAt, userAgent, ip); err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token": token,
		"user":  user,
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
		return
	}
	writeJSON(w, http.StatusOK, mustAuth(r).User)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
		return
	}
	ac := mustAuth(r)
	if ac.Token != "" {
		_ = s.store.DeleteSession(ac.Token)
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
		return
	}

	orgs, err := s.store.LoadOrganizations()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	contacts, err := s.store.LoadContacts()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	deals, err := s.store.LoadDeals()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	payments, err := s.store.LoadPayments()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	projects, err := s.store.LoadProjects()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	tasks, err := s.store.LoadTasks()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}

	users, err := s.store.LoadUsers()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	pipelines, err := s.store.LoadPipelines()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	pipelineStages, err := s.store.LoadPipelineStages()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	quotations, err := s.store.LoadQuotations()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	quotationItems, err := s.store.LoadQuotationItems()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}
	interactions, err := s.store.LoadInteractions()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"organizations":  orgs,
		"contacts":       contacts,
		"deals":          deals,
		"payments":       payments,
		"pipelines":      pipelines,
		"pipelineStages": pipelineStages,
		"projects":       projects,
		"tasks":          tasks,
		"quotations":     quotations,
		"quotationItems": quotationItems,
		"interactions":   interactions,
		"users":          users,
	})
}

func (s *Server) handleOrganizations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		orgs, err := s.store.LoadOrganizations()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, orgs)
	case http.MethodPost:
		var org models.Organization
		if err := readJSON(r, &org); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if org.ID == "" {
			org.ID = newID()
		}
		if org.CreatedAt.IsZero() {
			org.CreatedAt = now
		}
		org.UpdatedAt = now
		if org.Name == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("name is required"))
			return
		}
		if err := s.store.SaveOrganization(org); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, org)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteOrganization(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleContacts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		contacts, err := s.store.LoadContacts()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, contacts)
	case http.MethodPost:
		var c models.Contact
		if err := readJSON(r, &c); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if c.ID == "" {
			c.ID = newID()
		}
		if c.CreatedAt.IsZero() {
			c.CreatedAt = now
		}
		c.UpdatedAt = now

		if c.OrganizationID == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("organizationId is required"))
			return
		}
		if err := s.store.SaveContact(c); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, c)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteContact(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleDeals(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		deals, err := s.store.LoadDeals()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, deals)
	case http.MethodPost:
		var d models.Deal
		if err := readJSON(r, &d); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if d.ID == "" {
			d.ID = newID()
		}
		if d.CreatedAt.IsZero() {
			d.CreatedAt = now
		}
		d.UpdatedAt = now

		if d.Title == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("title is required"))
			return
		}
		if d.OrganizationID == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("organizationId is required"))
			return
		}
		if d.ContactID == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("contactId is required"))
			return
		}
		if d.Currency == "" {
			d.Currency = "EUR"
		}
		if d.Status == "" {
			d.Status = models.DealOpen
		}
		if strings.TrimSpace(d.PipelineStageID) == "" {
			pipelines, err := s.store.LoadPipelines()
			if err == nil && len(pipelines) > 0 {
				pipelineID := pipelines[0].ID
				for _, p := range pipelines {
					if p.Default {
						pipelineID = p.ID
						break
					}
				}
				stages, err := s.store.LoadPipelineStagesByPipeline(pipelineID)
				if err == nil && len(stages) > 0 {
					d.PipelineStageID = stages[0].ID
				}
			}
		}

		if err := s.store.SaveDeal(d); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, d)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteDeal(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handlePayments(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		dealID := strings.TrimSpace(r.URL.Query().Get("deal_id"))
		if dealID == "" {
			dealID = strings.TrimSpace(r.URL.Query().Get("dealId"))
		}

		var payments []models.Payment
		var err error
		if dealID != "" {
			payments, err = s.store.LoadPaymentsByDeal(dealID)
		} else {
			payments, err = s.store.LoadPayments()
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, payments)
	case http.MethodPost:
		var p models.Payment
		if err := readJSON(r, &p); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}

		now := time.Now()
		if p.ID == "" {
			p.ID = newID()
		}
		if p.CreatedAt.IsZero() {
			p.CreatedAt = now
		}
		p.UpdatedAt = now

		if strings.TrimSpace(p.DealID) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("dealId is required"))
			return
		}
		if strings.TrimSpace(p.Currency) == "" {
			p.Currency = "EUR"
		}
		if p.Status == "" {
			p.Status = models.PaymentPaid
		}
		switch p.Status {
		case models.PaymentPlanned, models.PaymentPaid, models.PaymentVoid:
			// ok
		default:
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid status"))
			return
		}

		if p.Amount < 0 {
			writeJSON(w, http.StatusBadRequest, errorResponse("amount must be >= 0"))
			return
		}
		if p.GilAmount < 0 || p.RicAmount < 0 {
			writeJSON(w, http.StatusBadRequest, errorResponse("gilAmount and ricAmount must be >= 0"))
			return
		}
		if (p.GilAmount + p.RicAmount) > (p.Amount + 0.01) {
			writeJSON(w, http.StatusBadRequest, errorResponse("gilAmount + ricAmount must be <= amount"))
			return
		}

		if p.Status == models.PaymentPaid {
			if p.PaidAt == nil || p.PaidAt.IsZero() {
				t := now
				p.PaidAt = &t
			}
		}

		if err := s.store.SavePayment(p); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, p)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeletePayment(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handlePipelines(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		pipelines, err := s.store.LoadPipelines()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, pipelines)
	case http.MethodPost:
		var p models.Pipeline
		if err := readJSON(r, &p); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if p.ID == "" {
			p.ID = newID()
		}
		if p.CreatedAt.IsZero() {
			p.CreatedAt = now
		}
		p.UpdatedAt = now

		if strings.TrimSpace(p.Name) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("name is required"))
			return
		}

		if p.Default {
			if _, err := s.store.DB.Exec(`UPDATE pipelines SET is_default = 0 WHERE id <> ?;`, p.ID); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}

		if err := s.store.SavePipeline(p); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, p)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeletePipeline(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handlePipelineStages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		stages, err := s.store.LoadPipelineStages()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, stages)
	case http.MethodPost:
		var st models.PipelineStage
		if err := readJSON(r, &st); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if st.ID == "" {
			st.ID = newID()
		}
		if st.CreatedAt.IsZero() {
			st.CreatedAt = now
		}
		st.UpdatedAt = now

		if strings.TrimSpace(st.PipelineID) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("pipelineId is required"))
			return
		}
		if strings.TrimSpace(st.Name) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("name is required"))
			return
		}
		if st.Position <= 0 {
			existing, err := s.store.LoadPipelineStagesByPipeline(st.PipelineID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			st.Position = len(existing) + 1
		}

		if err := s.store.SavePipelineStage(st); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, st)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeletePipelineStage(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		projects, err := s.store.LoadProjects()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, projects)
	case http.MethodPost:
		var p models.Project
		if err := readJSON(r, &p); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if p.ID == "" {
			p.ID = newID()
		}
		if p.CreatedAt.IsZero() {
			p.CreatedAt = now
		}
		p.UpdatedAt = now

		if strings.TrimSpace(p.DealID) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("dealId is required"))
			return
		}

		// Project name is derived from its Deal to keep projects lightweight.
		deals, err := s.store.LoadDeals()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		dealTitle := ""
		for _, d := range deals {
			if d.ID == p.DealID {
				dealTitle = strings.TrimSpace(d.Title)
				break
			}
		}
		if dealTitle == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("dealId not found"))
			return
		}
		p.Name = dealTitle
		p.Code = ""

		if p.Currency == "" {
			p.Currency = "EUR"
		}
		if p.Status == "" {
			p.Status = models.ProjectActive
		}

		if err := s.store.SaveProject(p); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, p)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteProject(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tasks, err := s.store.LoadTasks()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, tasks)
	case http.MethodPost:
		var t models.Task
		if err := readJSON(r, &t); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		isNew := strings.TrimSpace(t.ID) == ""
		now := time.Now()
		if t.ID == "" {
			t.ID = newID()
		}
		if t.CreatedAt.IsZero() {
			t.CreatedAt = now
		}
		t.UpdatedAt = now

		if t.Title == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("title is required"))
			return
		}
		if t.ProjectID == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("projectId is required"))
			return
		}
		if t.Status == "" {
			t.Status = models.TaskTodo
		}
		if strings.TrimSpace(t.OwnerUserID) == "" && isNew {
			t.OwnerUserID = mustAuth(r).User.ID
		}
		if strings.TrimSpace(t.OwnerUserID) != "" {
			_, ok, err := s.store.FindUserByID(t.OwnerUserID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, errorResponse("ownerUserId not found"))
				return
			}
		}

		if err := s.store.SaveTask(t); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, t)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteTask(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	ac := mustAuth(r)
	if ac.User.Role != models.RoleAdmin {
		writeJSON(w, http.StatusForbidden, errorResponse("forbidden"))
		return
	}

	switch r.Method {
	case http.MethodGet:
		users, err := s.store.LoadUsers()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, users)

	case http.MethodPost:
		var payload struct {
			ID           string `json:"id"`
			EmailAddress string `json:"emailAddress"`
			Name         string `json:"name"`
			Role         string `json:"role"`
			Password     string `json:"password"`
		}
		if err := readJSON(r, &payload); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}

		email := strings.ToLower(strings.TrimSpace(payload.EmailAddress))
		if email == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("emailAddress is required"))
			return
		}
		name := strings.TrimSpace(payload.Name)
		if name == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("name is required"))
			return
		}
		role := models.UserRole(strings.TrimSpace(payload.Role))
		if role == "" {
			role = models.RoleDeveloper
		}
		switch role {
		case models.RoleAdmin, models.RoleSales, models.RoleProjectManager, models.RoleDeveloper:
			// ok
		default:
			writeJSON(w, http.StatusBadRequest, errorResponse("invalid role"))
			return
		}

		now := time.Now()
		isNew := strings.TrimSpace(payload.ID) == ""

		var user models.User
		if !isNew {
			u, ok, err := s.store.FindUserByID(strings.TrimSpace(payload.ID))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			if !ok {
				writeJSON(w, http.StatusBadRequest, errorResponse("user not found"))
				return
			}
			user = u
		} else {
			if _, ok, err := s.store.FindUserByEmail(email); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			} else if ok {
				writeJSON(w, http.StatusConflict, errorResponse("emailAddress already exists"))
				return
			}
			user = models.User{
				ID:        newID(),
				CreatedAt: now,
			}
		}

		password := strings.TrimSpace(payload.Password)
		if password != "" {
			hash, err := auth.HashPassword(password)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			user.PasswordHash = hash
		} else if isNew {
			writeJSON(w, http.StatusBadRequest, errorResponse("password is required"))
			return
		}

		user.EmailAddress = email
		user.Name = name
		user.Role = role
		user.UpdatedAt = now

		if err := s.store.SaveUser(user); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, user)

	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			clean := strings.TrimSpace(id)
			if clean == "" {
				continue
			}
			if clean == ac.User.ID {
				writeJSON(w, http.StatusBadRequest, errorResponse("cannot delete your own user"))
				return
			}
			if err := s.store.DeleteUser(clean); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})

	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleQuotations(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		quotes, err := s.store.LoadQuotations()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, quotes)
	case http.MethodPost:
		var q models.Quotation
		if err := readJSON(r, &q); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if q.ID == "" {
			q.ID = newID()
		}
		if q.CreatedAt.IsZero() {
			q.CreatedAt = now
		}
		q.UpdatedAt = now

		if strings.TrimSpace(q.CreatedByUserID) == "" {
			q.CreatedByUserID = mustAuth(r).User.ID
		}
		if strings.TrimSpace(q.DealID) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("dealId is required"))
			return
		}
		if strings.TrimSpace(q.Title) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("title is required"))
			return
		}
		if strings.TrimSpace(q.Currency) == "" {
			q.Currency = "EUR"
		}
		if q.Status == "" {
			q.Status = models.QuotationDraft
		}
		if q.Version <= 0 {
			q.Version = 1
		}
		if strings.TrimSpace(q.Number) == "" {
			num, err := s.store.NextQuotationNumber(now.Year())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			q.Number = num
		}
		if strings.TrimSpace(q.PublicToken) == "" {
			tok, err := auth.NewToken(24)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			q.PublicToken = tok
		}

		if err := s.store.SaveQuotation(q); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		_ = s.store.RecalcQuotationTotals(q.ID)
		writeJSON(w, http.StatusOK, q)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteQuotation(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleQuotationItems(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := s.store.LoadQuotationItems()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, items)
	case http.MethodPost:
		var it models.QuotationItem
		if err := readJSON(r, &it); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		now := time.Now()
		if it.ID == "" {
			it.ID = newID()
		}
		if it.CreatedAt.IsZero() {
			it.CreatedAt = now
		}
		it.UpdatedAt = now

		if strings.TrimSpace(it.QuotationID) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("quotationId is required"))
			return
		}
		if strings.TrimSpace(it.Name) == "" {
			writeJSON(w, http.StatusBadRequest, errorResponse("name is required"))
			return
		}
		if it.Quantity == 0 {
			it.Quantity = 1
		}
		if it.LineTotal == 0 {
			it.LineTotal = it.Quantity * it.UnitPrice
		}
		if it.Position <= 0 {
			existing, err := s.store.LoadQuotationItemsByQuotation(it.QuotationID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			it.Position = len(existing) + 1
		}

		if err := s.store.SaveQuotationItem(it); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		_ = s.store.RecalcQuotationTotals(it.QuotationID)
		writeJSON(w, http.StatusOK, it)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		affected := make(map[string]struct{})
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			qid, err := s.store.DeleteQuotationItem(id)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
			if strings.TrimSpace(qid) != "" {
				affected[qid] = struct{}{}
			}
		}
		for qid := range affected {
			_ = s.store.RecalcQuotationTotals(qid)
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleInteractions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		interactions, err := s.store.LoadInteractions()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, interactions)
	case http.MethodPost:
		var i models.Interaction
		if err := readJSON(r, &i); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}

		now := time.Now()
		if i.ID == "" {
			i.ID = newID()
		}
		if i.CreatedAt.IsZero() {
			i.CreatedAt = now
		}
		i.UpdatedAt = now

		if strings.TrimSpace(i.UserID) == "" {
			i.UserID = mustAuth(r).User.ID
		}
		if i.InteractionType == "" {
			i.InteractionType = models.InteractionNote
		}
		if i.OccurredAt.IsZero() {
			i.OccurredAt = now
		}
		if strings.TrimSpace(i.TranscriptionLanguage) == "" {
			i.TranscriptionLanguage = "it"
		}
		if strings.TrimSpace(i.TranscriptionStatus) == "" {
			i.TranscriptionStatus = "pending"
		}

		if err := s.store.SaveInteraction(i); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, i)
	case http.MethodDelete:
		ids, err := deleteIDsFromRequest(r)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			if err := s.store.DeleteInteraction(id); err != nil {
				writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "deleted": ids})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.mu.RLock()
		cfg := s.settings
		s.mu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{
			"theme":                          cfg.Theme,
			"provider":                       cfg.Provider,
			"model":                          cfg.Model,
			"ollama_base_url":                cfg.OllamaBaseURL,
			"ollama_header_timeout_seconds":  cfg.OllamaHeaderTimeoutSeconds,
			"ollama_overall_timeout_seconds": cfg.OllamaOverallTimeoutSeconds,
			"ollama_max_attempts":            cfg.OllamaMaxAttempts,
			"ollama_backoff_base_ms":         cfg.OllamaBackoffBaseMs,
			"max_tokens":                     cfg.MaxTokens,
			"temperature":                    cfg.Temperature,
			"verbose":                        cfg.Verbose,
			"use_ansi":                       cfg.UseANSI,
			"auto_summary":                   cfg.AutoSummary,
			"has_openai_key":                 cfg.OpenAIKey != "",
			"has_anthropic_key":              cfg.AnthropicKey != "",
		})
	case http.MethodPost:
		var payload struct {
			Theme                       string              `json:"theme"`
			Provider                    config.ProviderType `json:"provider"`
			Model                       string              `json:"model"`
			OllamaBaseURL               string              `json:"ollama_base_url"`
			OllamaHeaderTimeoutSeconds  *int                `json:"ollama_header_timeout_seconds"`
			OllamaOverallTimeoutSeconds *int                `json:"ollama_overall_timeout_seconds"`
			OllamaMaxAttempts           *int                `json:"ollama_max_attempts"`
			OllamaBackoffBaseMs         *int                `json:"ollama_backoff_base_ms"`
			MaxTokens                   int                 `json:"max_tokens"`
			Temperature                 float64             `json:"temperature"`
			Verbose                     *bool               `json:"verbose"`
			UseANSI                     *bool               `json:"use_ansi"`
			AutoSummary                 *bool               `json:"auto_summary"`
			OpenAIKey                   string              `json:"openai_key"`
			AnthropicKey                string              `json:"anthropic_key"`
		}
		if err := readJSON(r, &payload); err != nil {
			writeJSON(w, http.StatusBadRequest, errorResponse(err.Error()))
			return
		}
		s.mu.Lock()
		if strings.TrimSpace(payload.Theme) != "" {
			s.settings.Theme = config.NormalizeTheme(payload.Theme)
		}
		if payload.Provider != "" {
			s.settings.Provider = payload.Provider
		}
		if payload.Model != "" {
			s.settings.Model = payload.Model
		}
		if payload.OllamaBaseURL != "" {
			s.settings.OllamaBaseURL = payload.OllamaBaseURL
		}
		if payload.OllamaHeaderTimeoutSeconds != nil {
			s.settings.OllamaHeaderTimeoutSeconds = *payload.OllamaHeaderTimeoutSeconds
		}
		if payload.OllamaOverallTimeoutSeconds != nil {
			s.settings.OllamaOverallTimeoutSeconds = *payload.OllamaOverallTimeoutSeconds
		}
		if payload.OllamaMaxAttempts != nil {
			s.settings.OllamaMaxAttempts = *payload.OllamaMaxAttempts
		}
		if payload.OllamaBackoffBaseMs != nil {
			s.settings.OllamaBackoffBaseMs = *payload.OllamaBackoffBaseMs
		}
		if payload.MaxTokens > 0 {
			s.settings.MaxTokens = payload.MaxTokens
		}
		if payload.Temperature > 0 {
			s.settings.Temperature = payload.Temperature
		}
		if payload.Verbose != nil {
			s.settings.Verbose = *payload.Verbose
		}
		if payload.UseANSI != nil {
			s.settings.UseANSI = *payload.UseANSI
		}
		if payload.AutoSummary != nil {
			s.settings.AutoSummary = *payload.AutoSummary
		}
		if payload.OpenAIKey != "" {
			s.settings.OpenAIKey = payload.OpenAIKey
		}
		if payload.AnthropicKey != "" {
			s.settings.AnthropicKey = payload.AnthropicKey
		}
		cfg := s.settings
		s.mu.Unlock()

		if err := config.Save(s.configPath, cfg); err != nil {
			writeJSON(w, http.StatusInternalServerError, errorResponse(err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func readJSON(r *http.Request, dest any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dest)
}

func errorResponse(message string) map[string]string {
	return map[string]string{"error": message}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func deleteIDsFromRequest(r *http.Request) ([]string, error) {
	if r == nil {
		return nil, errors.New("invalid request")
	}
	q := r.URL.Query()
	if id := strings.TrimSpace(q.Get("id")); id != "" {
		return []string{id}, nil
	}
	if idsRaw := strings.TrimSpace(q.Get("ids")); idsRaw != "" {
		parts := strings.Split(idsRaw, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if v := strings.TrimSpace(p); v != "" {
				out = append(out, v)
			}
		}
		if len(out) == 0 {
			return nil, errors.New("ids is empty")
		}
		return out, nil
	}

	var payload struct {
		ID  string   `json:"id"`
		IDs []string `json:"ids"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, errors.New("id or ids is required")
		}
		return nil, err
	}
	if strings.TrimSpace(payload.ID) != "" {
		return []string{payload.ID}, nil
	}
	out := make([]string, 0, len(payload.IDs))
	for _, v := range payload.IDs {
		if strings.TrimSpace(v) != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return nil, errors.New("id or ids is required")
	}
	return out, nil
}

func newID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
