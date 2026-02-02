# wemadeit - Development Guide

## Project Overview
Project management and CRM system for a software house. Built with Rails 8.1, Hotwire, Tailwind CSS.

## Tech Stack
- Ruby 3.4.7, Rails 8.1.1
- SQLite 3 (WAL mode, multi-database: primary, cache, queue, cable)
- Hotwire (Turbo + Stimulus)
- Tailwind CSS
- Solid Queue (background jobs)
- Prawn (PDF generation)

## Common Commands

### Development
```bash
rails s                      # Start server (port 3000)
bin/dev                      # Start with Procfile.dev (CSS watching)
rails c                      # Console
rails db:migrate             # Run migrations
rails db:seed                # Seed database
```

### Docker
```bash
docker compose up            # Start production containers
docker compose -f docker-compose.dev.yml up  # Development
```

### Testing
```bash
rails test                   # Run all tests
rails test:system            # System tests only
rails test test/models       # Model tests only
```

### Code Quality
```bash
bin/rubocop                  # Linting (Omakase style)
bin/brakeman                 # Security analysis
bundle audit                 # Dependency vulnerabilities
```

## Architecture Patterns

### Authentication (Custom, not Devise)
- `Current` model for thread-safe current user access
- `Authentication` concern in controllers
- Session-based with secure cookies
- IP and user agent tracking

### Authorization (Role-based)
- Roles: admin, sales, project_manager, developer
- Permission helpers: `can_manage_deals?`, `can_manage_projects?`
- Guard methods: `require_admin!`, `require_can_manage_deals!`

### Controllers
- Namespaced under `crm/` for CRM features
- Use concerns for cross-cutting behavior
- Strong params in private methods
- Turbo Stream responses for real-time updates

### Models
- Use enums for status/type fields
- Normalize data (strip, downcase emails)
- Scopes for common queries
- Callbacks sparingly, prefer service objects

### Views
- Tailwind CSS utilities (no custom CSS unless necessary)
- Turbo Frames for partial updates
- Stimulus controllers for JavaScript behavior
- Partials prefixed with underscore

### JavaScript (Stimulus)
- Controllers in `app/javascript/controllers/`
- Use data attributes: `data-controller`, `data-action`, `data-target`
- Keep controllers focused and small
- Use Turbo Streams for server-initiated updates

### Background Jobs
- Solid Queue (database-backed, no Redis)
- Jobs in `app/jobs/`
- Use `perform_later` for async execution
- Configure recurring jobs in `config/recurring.yml`

### PDF Generation
- Base class: `ApplicationPdf`
- PDF classes in `app/pdfs/`
- Use Prawn DSL for layout
- Store generated PDFs in Active Storage if needed

### AI Services
- Abstract provider layer in `app/services/ai/`
- `BaseService` handles provider switching
- Configuration stored in `ai_providers` table
- Background job processing for long operations

## File Naming Conventions

### Models
- Singular: `user.rb`, `organization.rb`
- Join tables: `project_member.rb`, `task_label.rb`

### Controllers
- Plural: `users_controller.rb`
- Namespaced: `crm/organizations_controller.rb`

### Views
- Folder matches controller: `views/users/`
- Partials: `_form.html.erb`, `_user.html.erb`
- Turbo streams: `create.turbo_stream.erb`

### Stimulus
- Kebab-case files: `kanban-controller.js`
- Auto-registered from `controllers/`

## Database Conventions

### SQLite Configuration
- Rails 8.1 auto-configures: WAL mode, synchronous=NORMAL, mmap_size=128MB, foreign_keys=ON
- `cache_size: -64000` (64MB) set via `pragmas:` in database.yml
- `timeout: 5000` configures busy_handler_timeout for write contention
- No additional PRAGMA tuning needed

### Migrations
- Use `references` for foreign keys
- Add indexes for frequently queried columns
- Use `null: false` for required fields
- Decimal for money: `precision: 12, scale: 2`

### Enums
```ruby
enum :status, { draft: 0, active: 1, completed: 2 }
```
- Always use integer-backed enums
- Prefix with `status_` if name conflicts

## Testing Guidelines

### Model Tests
- Test validations, associations, methods
- Use fixtures or Faker for data
- Test edge cases

### Controller Tests
- Test authentication/authorization
- Test happy path and error cases
- Use Turbo Stream assertions

### System Tests
- Test critical user flows
- Use Capybara + Selenium
- Keep tests independent

## Security Checklist
- [ ] Strong params on all controllers
- [ ] Authorization checks on actions
- [ ] CSRF protection (enabled by default)
- [ ] Content Security Policy configured
- [ ] Secrets in environment variables
- [ ] Brakeman scan passing

## Code Style (Omakase)
- 2 spaces indentation
- Double quotes for strings
- No trailing whitespace
- Blank line at end of files
- Run `bin/rubocop -a` to auto-fix

## Project Structure

```
app/
├── controllers/
│   ├── concerns/
│   │   ├── authentication.rb
│   │   └── authorization.rb
│   ├── crm/
│   │   ├── organizations_controller.rb
│   │   ├── contacts_controller.rb
│   │   ├── deals_controller.rb
│   │   └── pipelines_controller.rb
│   ├── projects_controller.rb
│   ├── quotations_controller.rb
│   └── dashboard_controller.rb
├── models/
│   ├── user.rb, session.rb, current.rb
│   ├── organization.rb, contact.rb
│   ├── pipeline.rb, pipeline_stage.rb, deal.rb
│   ├── project.rb, task.rb
│   └── quotation.rb, signature.rb
├── javascript/controllers/
│   ├── pipeline_controller.js
│   ├── kanban_controller.js
│   └── signature_pad_controller.js
├── pdfs/
│   ├── application_pdf.rb
│   └── quotation_pdf.rb
└── services/ai/
    ├── base_service.rb
    └── note_summarizer.rb
```

## Key Features

### CRM / Sales Pipeline
- Drag-and-drop deals between pipeline stages
- Organizations and contacts management
- Interaction tracking (calls, emails, meetings)
- Follow-up reminders

### Project Management
- Project lifecycle: presales → active → completed → support
- Kanban boards with drag-and-drop tasks
- Team assignment and milestones

### Quotation System
- Quote builder with line items
- PDF generation
- Shareable web link with public token
- E-signature (canvas-based)
- Quote-to-project conversion

### AI Integration
- Flexible provider support (Claude, OpenAI)
- Note summarization
- Email draft generation
- Scope analysis
