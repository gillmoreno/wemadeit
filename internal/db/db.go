package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"wemadeit/internal/auth"
	"wemadeit/internal/models"

	_ "modernc.org/sqlite"
)

type Store struct {
	DB *sql.DB
}

func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(dataDir, "wemadeit.sqlite3")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	store := &Store{DB: db}
	if _, err := store.DB.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		_ = db.Close()
		return nil, err
	}
	if err := store.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	return s.DB.Close()
}

func (s *Store) migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email_address TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL,
			user_agent TEXT NOT NULL DEFAULT '',
			ip_address TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE TABLE IF NOT EXISTS organizations (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			industry TEXT NOT NULL DEFAULT '',
			website TEXT NOT NULL DEFAULT '',
			email TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			billing_email TEXT NOT NULL DEFAULT '',
			tax_id TEXT NOT NULL DEFAULT '',
			address TEXT NOT NULL DEFAULT '',
			city TEXT NOT NULL DEFAULT '',
			country TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS contacts (
			id TEXT PRIMARY KEY,
			organization_id TEXT NOT NULL,
			first_name TEXT NOT NULL DEFAULT '',
			last_name TEXT NOT NULL DEFAULT '',
			job_title TEXT NOT NULL DEFAULT '',
			email TEXT NOT NULL DEFAULT '',
			phone TEXT NOT NULL DEFAULT '',
			mobile TEXT NOT NULL DEFAULT '',
			linkedin_url TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			primary_contact INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS deals (
			id TEXT PRIMARY KEY,
			organization_id TEXT NOT NULL,
			contact_id TEXT NOT NULL,
			pipeline_stage_id TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			domain TEXT NOT NULL DEFAULT '',
			domain_acquired_at INTEGER NOT NULL DEFAULT 0,
			domain_expires_at INTEGER NOT NULL DEFAULT 0,
			domain_cost REAL NOT NULL DEFAULT 0,
			deposit REAL NOT NULL DEFAULT 0,
			costs REAL NOT NULL DEFAULT 0,
			taxes REAL NOT NULL DEFAULT 0,
			net_total REAL NOT NULL DEFAULT 0,
			share_gil REAL NOT NULL DEFAULT 0,
			share_ric REAL NOT NULL DEFAULT 0,
			work_type TEXT NOT NULL DEFAULT '',
			work_closed_at INTEGER NOT NULL DEFAULT 0,
			value REAL NOT NULL DEFAULT 0,
			currency TEXT NOT NULL DEFAULT 'EUR',
			expected_close_at INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'open',
			probability INTEGER NOT NULL DEFAULT 0,
			source TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			lost_reason TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS pipelines (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			is_default INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS pipeline_stages (
			id TEXT PRIMARY KEY,
			pipeline_id TEXT NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL DEFAULT '',
			position INTEGER NOT NULL DEFAULT 0,
			probability REAL NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			deal_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			code TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'active',
			start_date INTEGER NOT NULL DEFAULT 0,
			target_end_date INTEGER NOT NULL DEFAULT 0,
			actual_end_date INTEGER NOT NULL DEFAULT 0,
			budget REAL NOT NULL DEFAULT 0,
			currency TEXT NOT NULL DEFAULT 'EUR',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'todo',
			priority INTEGER NOT NULL DEFAULT 0,
			due_date INTEGER NOT NULL DEFAULT 0,
			estimated_hours INTEGER NOT NULL DEFAULT 0,
			actual_hours INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS quotations (
			id TEXT PRIMARY KEY,
			deal_id TEXT NOT NULL,
			created_by_user_id TEXT NOT NULL,
			number TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			introduction TEXT NOT NULL DEFAULT '',
			terms_and_conditions TEXT NOT NULL DEFAULT '',
			currency TEXT NOT NULL DEFAULT 'EUR',
			status TEXT NOT NULL DEFAULT 'draft',
			subtotal REAL NOT NULL DEFAULT 0,
			tax_rate REAL NOT NULL DEFAULT 0,
			tax_amount REAL NOT NULL DEFAULT 0,
			discount_amount REAL NOT NULL DEFAULT 0,
			total REAL NOT NULL DEFAULT 0,
			valid_until INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			public_token TEXT NOT NULL DEFAULT '',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS quotation_items (
			id TEXT PRIMARY KEY,
			quotation_id TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			quantity REAL NOT NULL DEFAULT 1,
			unit_price REAL NOT NULL DEFAULT 0,
			unit_type TEXT NOT NULL DEFAULT '',
			line_total REAL NOT NULL DEFAULT 0,
			position INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS interactions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			organization_id TEXT NOT NULL DEFAULT '',
			contact_id TEXT NOT NULL DEFAULT '',
			deal_id TEXT NOT NULL DEFAULT '',
			interaction_type TEXT NOT NULL DEFAULT 'note',
			subject TEXT NOT NULL DEFAULT '',
			body TEXT NOT NULL DEFAULT '',
			occurred_at INTEGER NOT NULL DEFAULT 0,
			duration_minutes INTEGER NOT NULL DEFAULT 0,
			transcript TEXT NOT NULL DEFAULT '',
			cleaned_transcript TEXT NOT NULL DEFAULT '',
			follow_up_completed INTEGER NOT NULL DEFAULT 0,
			follow_up_date INTEGER NOT NULL DEFAULT 0,
			follow_up_notes TEXT NOT NULL DEFAULT '',
			transcription_language TEXT NOT NULL DEFAULT 'it',
			transcription_status TEXT NOT NULL DEFAULT 'pending',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
	}
	for _, stmt := range stmts {
		if _, err := s.DB.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	// Forward-only compatibility for older DBs.
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN pipeline_stage_id TEXT NOT NULL DEFAULT '';`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN domain TEXT NOT NULL DEFAULT '';`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN domain_acquired_at INTEGER NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN domain_expires_at INTEGER NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN domain_cost REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN deposit REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN costs REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN taxes REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN net_total REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN share_gil REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN share_ric REAL NOT NULL DEFAULT 0;`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN work_type TEXT NOT NULL DEFAULT '';`)
	_, _ = s.DB.Exec(`ALTER TABLE deals ADD COLUMN work_closed_at INTEGER NOT NULL DEFAULT 0;`)
	return nil
}

func (s *Store) SeedIfNeeded() error {
	now := time.Now()

	users, err := s.LoadUsers()
	if err != nil {
		return err
	}
	var seededUser models.User
	if len(users) == 0 {
		adminEmail := strings.TrimSpace(os.Getenv("WEMADEIT_ADMIN_EMAIL"))
		if adminEmail == "" {
			adminEmail = "admin@wemadeit.local"
		} else {
			adminEmail = strings.ToLower(adminEmail)
		}

		adminPassword := os.Getenv("WEMADEIT_ADMIN_PASSWORD")
		if strings.TrimSpace(adminPassword) == "" {
			adminPassword = "admin"
		}

		adminName := strings.TrimSpace(os.Getenv("WEMADEIT_ADMIN_NAME"))
		if adminName == "" {
			adminName = "Admin"
		}

		hash, err := auth.HashPassword(adminPassword)
		if err != nil {
			return err
		}
		seededUser = models.User{
			ID:           newID(),
			EmailAddress: adminEmail,
			Name:         adminName,
			Role:         models.RoleAdmin,
			PasswordHash: hash,
			CreatedAt:    now,
			UpdatedAt:    now,
		}
		if err := s.SaveUser(seededUser); err != nil {
			return err
		}
	} else {
		seededUser = users[0]
	}

	pipelines, err := s.LoadPipelines()
	if err != nil {
		return err
	}

	pipelineID := ""
	for _, p := range pipelines {
		if p.Default {
			pipelineID = p.ID
			break
		}
	}
	if pipelineID == "" && len(pipelines) > 0 {
		pipelineID = pipelines[0].ID
	}

	if pipelineID == "" {
		pipeline := models.Pipeline{
			ID:          newID(),
			Name:        "Sales Pipeline",
			Description: "Default sales stages.",
			Default:     true,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := s.SavePipeline(pipeline); err != nil {
			return err
		}
		pipelineID = pipeline.ID
	}

	stages, err := s.LoadPipelineStagesByPipeline(pipelineID)
	if err != nil {
		return err
	}
	if len(stages) == 0 {
		defaultStages := []struct {
			name  string
			color string
			prob  float64
		}{
			{name: "Lead", color: "#CF8445", prob: 10},
			{name: "Qualified", color: "#DC9F68", prob: 30},
			{name: "Proposal", color: "#E9C29A", prob: 55},
			{name: "Won", color: "#22C55E", prob: 100},
			{name: "Lost", color: "#64748B", prob: 0},
		}
		for idx, st := range defaultStages {
			stage := models.PipelineStage{
				ID:          newID(),
				PipelineID:  pipelineID,
				Name:        st.name,
				Color:       st.color,
				Position:    idx + 1,
				Probability: st.prob,
				CreatedAt:   now,
				UpdatedAt:   now,
			}
			if err := s.SavePipelineStage(stage); err != nil {
				return err
			}
		}
		stages, err = s.LoadPipelineStagesByPipeline(pipelineID)
		if err != nil {
			return err
		}
	}

	defaultStageID := ""
	if len(stages) > 0 {
		defaultStageID = stages[0].ID
	}

	// Backfill deals that predate pipeline support.
	if defaultStageID != "" {
		_, _ = s.DB.Exec(`UPDATE deals SET pipeline_stage_id = ? WHERE pipeline_stage_id = '';`, defaultStageID)
	}

	orgs, err := s.LoadOrganizations()
	if err != nil {
		return err
	}
	if len(orgs) > 0 {
		return nil
	}

	org := models.Organization{
		ID:           newID(),
		Name:         "Example Studio",
		Industry:     "Design + Engineering",
		Website:      "https://example.com",
		Email:        "hello@example.com",
		Phone:        "+1 555 000 0000",
		BillingEmail: "billing@example.com",
		TaxID:        "",
		Address:      "123 Main Street",
		City:         "New York",
		Country:      "US",
		Notes:        "Seeded organization.",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.SaveOrganization(org); err != nil {
		return err
	}

	contact := models.Contact{
		ID:             newID(),
		OrganizationID: org.ID,
		FirstName:      "Avery",
		LastName:       "Client",
		JobTitle:       "Operations",
		Email:          "avery@example.com",
		Phone:          "",
		Mobile:         "",
		LinkedInURL:    "",
		Notes:          "",
		PrimaryContact: true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.SaveContact(contact); err != nil {
		return err
	}

	deal := models.Deal{
		ID:              newID(),
		OrganizationID:  org.ID,
		ContactID:       contact.ID,
		PipelineStageID: defaultStageID,
		Title:           "Website refresh",
		Description:     "Design + build marketing site refresh.",
		Value:           12000,
		Currency:        "USD",
		Status:          models.DealOpen,
		Probability:     35,
		Source:          "Referral",
		Notes:           "",
		LostReason:      "",
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.SaveDeal(deal); err != nil {
		return err
	}

	project := models.Project{
		ID:          newID(),
		DealID:      deal.ID,
		Name:        "Website refresh",
		Description: "Project created from the initial deal.",
		Code:        "WM-001",
		Status:      models.ProjectActive,
		Budget:      12000,
		Currency:    "USD",
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.SaveProject(project); err != nil {
		return err
	}

	task := models.Task{
		ID:             newID(),
		ProjectID:      project.ID,
		Title:          "Kickoff call",
		Description:    "Schedule and run kickoff with stakeholder list.",
		Status:         models.TaskTodo,
		Priority:       1,
		EstimatedHours: 1,
		ActualHours:    0,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.SaveTask(task); err != nil {
		return err
	}

	// Avoid unused var warnings while this seed is intentionally minimal.
	_ = seededUser
	return nil
}

func (s *Store) SaveOrganization(org models.Organization) error {
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO organizations
		(id, name, industry, website, email, phone, billing_email, tax_id, address, city, country, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		org.ID,
		org.Name,
		org.Industry,
		org.Website,
		org.Email,
		org.Phone,
		org.BillingEmail,
		org.TaxID,
		org.Address,
		org.City,
		org.Country,
		org.Notes,
		org.CreatedAt.Unix(),
		org.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadOrganizations() ([]models.Organization, error) {
	rows, err := s.DB.Query(`SELECT id, name, industry, website, email, phone, billing_email, tax_id, address, city, country, notes, created_at, updated_at FROM organizations ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orgs := make([]models.Organization, 0)
	for rows.Next() {
		var org models.Organization
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&org.ID,
			&org.Name,
			&org.Industry,
			&org.Website,
			&org.Email,
			&org.Phone,
			&org.BillingEmail,
			&org.TaxID,
			&org.Address,
			&org.City,
			&org.Country,
			&org.Notes,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		org.CreatedAt = time.Unix(createdUnix, 0)
		org.UpdatedAt = time.Unix(updatedUnix, 0)
		orgs = append(orgs, org)
	}
	return orgs, rows.Err()
}

func (s *Store) DeleteOrganization(orgID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Delete interactions referencing contacts under this org.
	if _, err = tx.Exec(`DELETE FROM interactions WHERE contact_id IN (SELECT id FROM contacts WHERE organization_id = ?);`, orgID); err != nil {
		return err
	}
	// Delete interactions referencing deals under this org.
	if _, err = tx.Exec(`DELETE FROM interactions WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?);`, orgID); err != nil {
		return err
	}

	// Delete tasks/projects under deals for this org.
	if _, err = tx.Exec(`DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?));`, orgID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM projects WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?);`, orgID); err != nil {
		return err
	}

	// Delete quotations/items under deals for this org.
	if _, err = tx.Exec(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?));`, orgID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotations WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?);`, orgID); err != nil {
		return err
	}

	// Delete interactions referencing the org directly.
	if _, err = tx.Exec(`DELETE FROM interactions WHERE organization_id = ?;`, orgID); err != nil {
		return err
	}

	// Delete deals, contacts, org.
	if _, err = tx.Exec(`DELETE FROM deals WHERE organization_id = ?;`, orgID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM contacts WHERE organization_id = ?;`, orgID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM organizations WHERE id = ?;`, orgID); err != nil {
		return err
	}

	err = tx.Commit()
	return err
}

func (s *Store) SaveContact(c models.Contact) error {
	primary := 0
	if c.PrimaryContact {
		primary = 1
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO contacts
		(id, organization_id, first_name, last_name, job_title, email, phone, mobile, linkedin_url, notes, primary_contact, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		c.ID,
		c.OrganizationID,
		c.FirstName,
		c.LastName,
		c.JobTitle,
		c.Email,
		c.Phone,
		c.Mobile,
		c.LinkedInURL,
		c.Notes,
		primary,
		c.CreatedAt.Unix(),
		c.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadContacts() ([]models.Contact, error) {
	rows, err := s.DB.Query(`SELECT id, organization_id, first_name, last_name, job_title, email, phone, mobile, linkedin_url, notes, primary_contact, created_at, updated_at FROM contacts ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	contacts := make([]models.Contact, 0)
	for rows.Next() {
		var c models.Contact
		var primary int
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&c.ID,
			&c.OrganizationID,
			&c.FirstName,
			&c.LastName,
			&c.JobTitle,
			&c.Email,
			&c.Phone,
			&c.Mobile,
			&c.LinkedInURL,
			&c.Notes,
			&primary,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		c.PrimaryContact = primary != 0
		c.CreatedAt = time.Unix(createdUnix, 0)
		c.UpdatedAt = time.Unix(updatedUnix, 0)
		contacts = append(contacts, c)
	}
	return contacts, rows.Err()
}

func (s *Store) DeleteContact(contactID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Delete interactions referencing the contact directly.
	if _, err = tx.Exec(`DELETE FROM interactions WHERE contact_id = ?;`, contactID); err != nil {
		return err
	}

	// Delete cascades under deals owned by this contact.
	if _, err = tx.Exec(`DELETE FROM interactions WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ?);`, contactID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ?));`, contactID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM projects WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ?);`, contactID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ?));`, contactID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotations WHERE deal_id IN (SELECT id FROM deals WHERE contact_id = ?);`, contactID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM deals WHERE contact_id = ?;`, contactID); err != nil {
		return err
	}

	if _, err = tx.Exec(`DELETE FROM contacts WHERE id = ?;`, contactID); err != nil {
		return err
	}

	err = tx.Commit()
	return err
}

func (s *Store) SaveDeal(d models.Deal) error {
	domainAcquiredUnix := int64(0)
	if d.DomainAcquiredAt != nil {
		domainAcquiredUnix = d.DomainAcquiredAt.Unix()
	}

	domainExpiresUnix := int64(0)
	if d.DomainExpiresAt != nil {
		domainExpiresUnix = d.DomainExpiresAt.Unix()
	}

	workClosedUnix := int64(0)
	if d.WorkClosedAt != nil {
		workClosedUnix = d.WorkClosedAt.Unix()
	}

	expectedCloseUnix := int64(0)
	if d.ExpectedCloseAt != nil {
		expectedCloseUnix = d.ExpectedCloseAt.Unix()
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO deals
		(id, organization_id, contact_id, pipeline_stage_id, title, description,
		 domain, domain_acquired_at, domain_expires_at, domain_cost,
		 deposit, costs, taxes, net_total, share_gil, share_ric, work_type, work_closed_at,
		 value, currency, expected_close_at, status, probability, source, notes, lost_reason, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?,
		        ?, ?, ?, ?,
		        ?, ?, ?, ?, ?, ?, ?, ?,
		        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		d.ID,
		d.OrganizationID,
		d.ContactID,
		d.PipelineStageID,
		d.Title,
		d.Description,
		d.Domain,
		domainAcquiredUnix,
		domainExpiresUnix,
		d.DomainCost,
		d.Deposit,
		d.Costs,
		d.Taxes,
		d.NetTotal,
		d.ShareGil,
		d.ShareRic,
		d.WorkType,
		workClosedUnix,
		d.Value,
		d.Currency,
		expectedCloseUnix,
		string(d.Status),
		d.Probability,
		d.Source,
		d.Notes,
		d.LostReason,
		d.CreatedAt.Unix(),
		d.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadDeals() ([]models.Deal, error) {
	rows, err := s.DB.Query(`SELECT
		id, organization_id, contact_id, pipeline_stage_id, title, description,
		domain, domain_acquired_at, domain_expires_at, domain_cost,
		deposit, costs, taxes, net_total, share_gil, share_ric, work_type, work_closed_at,
		value, currency, expected_close_at, status, probability, source, notes, lost_reason, created_at, updated_at
		FROM deals ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	deals := make([]models.Deal, 0)
	for rows.Next() {
		var d models.Deal
		var domainAcquiredUnix int64
		var domainExpiresUnix int64
		var workClosedUnix int64
		var expectedCloseUnix int64
		var status string
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&d.ID,
			&d.OrganizationID,
			&d.ContactID,
			&d.PipelineStageID,
			&d.Title,
			&d.Description,
			&d.Domain,
			&domainAcquiredUnix,
			&domainExpiresUnix,
			&d.DomainCost,
			&d.Deposit,
			&d.Costs,
			&d.Taxes,
			&d.NetTotal,
			&d.ShareGil,
			&d.ShareRic,
			&d.WorkType,
			&workClosedUnix,
			&d.Value,
			&d.Currency,
			&expectedCloseUnix,
			&status,
			&d.Probability,
			&d.Source,
			&d.Notes,
			&d.LostReason,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		if domainAcquiredUnix > 0 {
			t := time.Unix(domainAcquiredUnix, 0)
			d.DomainAcquiredAt = &t
		}
		if domainExpiresUnix > 0 {
			t := time.Unix(domainExpiresUnix, 0)
			d.DomainExpiresAt = &t
		}
		if workClosedUnix > 0 {
			t := time.Unix(workClosedUnix, 0)
			d.WorkClosedAt = &t
		}
		if expectedCloseUnix > 0 {
			t := time.Unix(expectedCloseUnix, 0)
			d.ExpectedCloseAt = &t
		}
		d.Status = models.DealStatus(status)
		d.CreatedAt = time.Unix(createdUnix, 0)
		d.UpdatedAt = time.Unix(updatedUnix, 0)
		deals = append(deals, d)
	}
	return deals, rows.Err()
}

func (s *Store) DeleteDeal(dealID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(`DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE deal_id = ?);`, dealID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM projects WHERE deal_id = ?;`, dealID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE deal_id = ?);`, dealID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotations WHERE deal_id = ?;`, dealID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM interactions WHERE deal_id = ?;`, dealID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM deals WHERE id = ?;`, dealID); err != nil {
		return err
	}

	err = tx.Commit()
	return err
}

func (s *Store) SaveProject(p models.Project) error {
	startUnix := int64(0)
	if p.StartDate != nil {
		startUnix = p.StartDate.Unix()
	}
	targetUnix := int64(0)
	if p.TargetEndDate != nil {
		targetUnix = p.TargetEndDate.Unix()
	}
	actualUnix := int64(0)
	if p.ActualEndDate != nil {
		actualUnix = p.ActualEndDate.Unix()
	}

	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO projects
		(id, deal_id, name, description, code, status, start_date, target_end_date, actual_end_date, budget, currency, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		p.ID,
		p.DealID,
		p.Name,
		p.Description,
		p.Code,
		string(p.Status),
		startUnix,
		targetUnix,
		actualUnix,
		p.Budget,
		p.Currency,
		p.CreatedAt.Unix(),
		p.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadProjects() ([]models.Project, error) {
	rows, err := s.DB.Query(`SELECT id, deal_id, name, description, code, status, start_date, target_end_date, actual_end_date, budget, currency, created_at, updated_at FROM projects ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := make([]models.Project, 0)
	for rows.Next() {
		var p models.Project
		var status string
		var startUnix, targetUnix, actualUnix int64
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&p.ID,
			&p.DealID,
			&p.Name,
			&p.Description,
			&p.Code,
			&status,
			&startUnix,
			&targetUnix,
			&actualUnix,
			&p.Budget,
			&p.Currency,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		p.Status = models.ProjectStatus(status)
		if startUnix > 0 {
			t := time.Unix(startUnix, 0)
			p.StartDate = &t
		}
		if targetUnix > 0 {
			t := time.Unix(targetUnix, 0)
			p.TargetEndDate = &t
		}
		if actualUnix > 0 {
			t := time.Unix(actualUnix, 0)
			p.ActualEndDate = &t
		}
		p.CreatedAt = time.Unix(createdUnix, 0)
		p.UpdatedAt = time.Unix(updatedUnix, 0)
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *Store) DeleteProject(projectID string) error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(`DELETE FROM tasks WHERE project_id = ?;`, projectID); err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM projects WHERE id = ?;`, projectID); err != nil {
		return err
	}
	err = tx.Commit()
	return err
}

func (s *Store) SaveTask(t models.Task) error {
	dueUnix := int64(0)
	if t.DueDate != nil {
		dueUnix = t.DueDate.Unix()
	}
	_, err := s.DB.Exec(
		`INSERT OR REPLACE INTO tasks
		(id, project_id, title, description, status, priority, due_date, estimated_hours, actual_hours, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		t.ID,
		t.ProjectID,
		t.Title,
		t.Description,
		string(t.Status),
		t.Priority,
		dueUnix,
		t.EstimatedHours,
		t.ActualHours,
		t.CreatedAt.Unix(),
		t.UpdatedAt.Unix(),
	)
	return err
}

func (s *Store) LoadTasks() ([]models.Task, error) {
	rows, err := s.DB.Query(`SELECT id, project_id, title, description, status, priority, due_date, estimated_hours, actual_hours, created_at, updated_at FROM tasks ORDER BY created_at DESC;`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]models.Task, 0)
	for rows.Next() {
		var t models.Task
		var status string
		var dueUnix int64
		var createdUnix, updatedUnix int64
		if err := rows.Scan(
			&t.ID,
			&t.ProjectID,
			&t.Title,
			&t.Description,
			&status,
			&t.Priority,
			&dueUnix,
			&t.EstimatedHours,
			&t.ActualHours,
			&createdUnix,
			&updatedUnix,
		); err != nil {
			return nil, err
		}
		t.Status = models.TaskStatus(status)
		if dueUnix > 0 {
			d := time.Unix(dueUnix, 0)
			t.DueDate = &d
		}
		t.CreatedAt = time.Unix(createdUnix, 0)
		t.UpdatedAt = time.Unix(updatedUnix, 0)
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *Store) DeleteTask(taskID string) error {
	_, err := s.DB.Exec(`DELETE FROM tasks WHERE id = ?;`, taskID)
	return err
}

func newID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
