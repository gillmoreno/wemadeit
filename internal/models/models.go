package models

import "time"

type Organization struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Industry     string    `json:"industry"`
	Website      string    `json:"website"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	BillingEmail string    `json:"billingEmail"`
	TaxID        string    `json:"taxId"`
	Address      string    `json:"address"`
	City         string    `json:"city"`
	Country      string    `json:"country"`
	Notes        string    `json:"notes"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Contact struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organizationId"`
	FirstName      string    `json:"firstName"`
	LastName       string    `json:"lastName"`
	JobTitle       string    `json:"jobTitle"`
	Email          string    `json:"email"`
	Phone          string    `json:"phone"`
	Mobile         string    `json:"mobile"`
	LinkedInURL    string    `json:"linkedinUrl"`
	Notes          string    `json:"notes"`
	PrimaryContact bool      `json:"primaryContact"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type DealStatus string

const (
	DealOpen DealStatus = "open"
	DealWon  DealStatus = "won"
	DealLost DealStatus = "lost"
)

type Deal struct {
	ID              string `json:"id"`
	OrganizationID  string `json:"organizationId"`
	ContactID       string `json:"contactId"`
	PipelineStageID string `json:"pipelineStageId"`
	Title           string `json:"title"`
	Description     string `json:"description"`

	// Job tracking (mirrors partner's Excel sheet fields).
	Domain           string     `json:"domain"`
	DomainAcquiredAt *time.Time `json:"domainAcquiredAt,omitempty"`
	DomainExpiresAt  *time.Time `json:"domainExpiresAt,omitempty"`
	DomainCost       float64    `json:"domainCost"`

	Deposit      float64    `json:"deposit"`
	Costs        float64    `json:"costs"`
	Taxes        float64    `json:"taxes"`
	NetTotal     float64    `json:"netTotal"`
	ShareGil     float64    `json:"shareGil"`
	ShareRic     float64    `json:"shareRic"`
	WorkType     string     `json:"workType"`
	WorkClosedAt *time.Time `json:"workClosedAt,omitempty"`

	Value           float64    `json:"value"`
	Currency        string     `json:"currency"`
	ExpectedCloseAt *time.Time `json:"expectedCloseAt,omitempty"`
	Status          DealStatus `json:"status"`
	Probability     int        `json:"probability"`
	Source          string     `json:"source"`
	Notes           string     `json:"notes"`
	LostReason      string     `json:"lostReason"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
}

type PaymentStatus string

const (
	PaymentPlanned PaymentStatus = "planned"
	PaymentPaid    PaymentStatus = "paid"
	PaymentVoid    PaymentStatus = "void"
)

type Payment struct {
	ID       string        `json:"id"`
	DealID   string        `json:"dealId"`
	Title    string        `json:"title"`
	Amount   float64       `json:"amount"`
	Currency string        `json:"currency"`
	Status   PaymentStatus `json:"status"`
	DueAt    *time.Time    `json:"dueAt,omitempty"`
	PaidAt   *time.Time    `json:"paidAt,omitempty"`
	Method   string        `json:"method"`
	Notes    string        `json:"notes"`

	GilAmount float64 `json:"gilAmount"`
	RicAmount float64 `json:"ricAmount"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Pipeline struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Default     bool      `json:"default"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type PipelineStage struct {
	ID          string    `json:"id"`
	PipelineID  string    `json:"pipelineId"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Position    int       `json:"position"`
	Probability float64   `json:"probability"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UserRole string

const (
	RoleAdmin          UserRole = "admin"
	RoleSales          UserRole = "sales"
	RoleProjectManager UserRole = "project_manager"
	RoleDeveloper      UserRole = "developer"
)

type User struct {
	ID           string    `json:"id"`
	EmailAddress string    `json:"emailAddress"`
	Name         string    `json:"name"`
	Role         UserRole  `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type InteractionType string

const (
	InteractionCall    InteractionType = "call"
	InteractionEmail   InteractionType = "email"
	InteractionMeeting InteractionType = "meeting"
	InteractionNote    InteractionType = "note"
)

type Interaction struct {
	ID                    string          `json:"id"`
	UserID                string          `json:"userId"`
	OrganizationID        string          `json:"organizationId"`
	ContactID             string          `json:"contactId"`
	DealID                string          `json:"dealId"`
	InteractionType       InteractionType `json:"interactionType"`
	Subject               string          `json:"subject"`
	Body                  string          `json:"body"`
	OccurredAt            time.Time       `json:"occurredAt"`
	DurationMinutes       int             `json:"durationMinutes"`
	Transcript            string          `json:"transcript"`
	CleanedTranscript     string          `json:"cleanedTranscript"`
	FollowUpCompleted     bool            `json:"followUpCompleted"`
	FollowUpDate          *time.Time      `json:"followUpDate,omitempty"`
	FollowUpNotes         string          `json:"followUpNotes"`
	TranscriptionLanguage string          `json:"transcriptionLanguage"`
	TranscriptionStatus   string          `json:"transcriptionStatus"`
	CreatedAt             time.Time       `json:"createdAt"`
	UpdatedAt             time.Time       `json:"updatedAt"`
}

type QuotationStatus string

const (
	QuotationDraft    QuotationStatus = "draft"
	QuotationSent     QuotationStatus = "sent"
	QuotationViewed   QuotationStatus = "viewed"
	QuotationAccepted QuotationStatus = "accepted"
	QuotationDeclined QuotationStatus = "declined"
	QuotationExpired  QuotationStatus = "expired"
)

type Quotation struct {
	ID              string          `json:"id"`
	DealID          string          `json:"dealId"`
	CreatedByUserID string          `json:"createdByUserId"`
	Number          string          `json:"number"`
	Title           string          `json:"title"`
	Introduction    string          `json:"introduction"`
	Terms           string          `json:"terms"`
	Currency        string          `json:"currency"`
	Status          QuotationStatus `json:"status"`
	Subtotal        float64         `json:"subtotal"`
	TaxRate         float64         `json:"taxRate"`
	TaxAmount       float64         `json:"taxAmount"`
	DiscountAmount  float64         `json:"discountAmount"`
	Total           float64         `json:"total"`
	ValidUntil      *time.Time      `json:"validUntil,omitempty"`
	Version         int             `json:"version"`
	PublicToken     string          `json:"publicToken"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

type QuotationItem struct {
	ID          string    `json:"id"`
	QuotationID string    `json:"quotationId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Quantity    float64   `json:"quantity"`
	UnitPrice   float64   `json:"unitPrice"`
	UnitType    string    `json:"unitType"`
	LineTotal   float64   `json:"lineTotal"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type ProjectStatus string

const (
	ProjectActive    ProjectStatus = "active"
	ProjectCompleted ProjectStatus = "completed"
	ProjectSupport   ProjectStatus = "support"
)

type Project struct {
	ID            string        `json:"id"`
	DealID        string        `json:"dealId"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	Code          string        `json:"code"`
	Status        ProjectStatus `json:"status"`
	StartDate     *time.Time    `json:"startDate,omitempty"`
	TargetEndDate *time.Time    `json:"targetEndDate,omitempty"`
	ActualEndDate *time.Time    `json:"actualEndDate,omitempty"`
	Budget        float64       `json:"budget"`
	Currency      string        `json:"currency"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

type TaskStatus string

const (
	TaskTodo       TaskStatus = "todo"
	TaskInProgress TaskStatus = "in_progress"
	TaskDone       TaskStatus = "done"
	TaskBlocked    TaskStatus = "blocked"
)

type Task struct {
	ID             string     `json:"id"`
	ProjectID      string     `json:"projectId"`
	OwnerUserID    string     `json:"ownerUserId"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Status         TaskStatus `json:"status"`
	Priority       int        `json:"priority"`
	DueDate        *time.Time `json:"dueDate,omitempty"`
	EstimatedHours int        `json:"estimatedHours"`
	ActualHours    int        `json:"actualHours"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}
