# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_01_07_165708) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "ai_providers", force: :cascade do |t|
    t.boolean "active"
    t.string "api_key_encrypted"
    t.datetime "created_at", null: false
    t.boolean "default"
    t.string "model"
    t.string "name"
    t.jsonb "settings"
    t.datetime "updated_at", null: false
  end

  create_table "contacts", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email"
    t.string "first_name"
    t.string "job_title"
    t.string "last_name"
    t.string "linkedin_url"
    t.string "mobile"
    t.text "notes"
    t.bigint "organization_id", null: false
    t.string "phone"
    t.boolean "primary_contact"
    t.datetime "updated_at", null: false
    t.index ["organization_id"], name: "index_contacts_on_organization_id"
  end

  create_table "deals", force: :cascade do |t|
    t.bigint "assigned_to_id", null: false
    t.bigint "contact_id", null: false
    t.datetime "created_at", null: false
    t.string "currency"
    t.date "expected_close_date"
    t.text "lost_reason"
    t.text "notes"
    t.bigint "organization_id", null: false
    t.bigint "pipeline_stage_id", null: false
    t.string "source"
    t.integer "status"
    t.string "title"
    t.datetime "updated_at", null: false
    t.decimal "value"
    t.index ["assigned_to_id"], name: "index_deals_on_assigned_to_id"
    t.index ["contact_id"], name: "index_deals_on_contact_id"
    t.index ["organization_id"], name: "index_deals_on_organization_id"
    t.index ["pipeline_stage_id"], name: "index_deals_on_pipeline_stage_id"
  end

  create_table "interactions", force: :cascade do |t|
    t.text "body"
    t.text "cleaned_transcript"
    t.bigint "contact_id"
    t.datetime "created_at", null: false
    t.bigint "deal_id"
    t.integer "duration_minutes"
    t.boolean "follow_up_completed"
    t.datetime "follow_up_date"
    t.text "follow_up_notes"
    t.integer "interaction_type"
    t.datetime "occurred_at"
    t.bigint "organization_id"
    t.string "subject"
    t.text "transcript"
    t.string "transcription_language", default: "it"
    t.integer "transcription_status", default: 0
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["contact_id"], name: "index_interactions_on_contact_id"
    t.index ["deal_id"], name: "index_interactions_on_deal_id"
    t.index ["organization_id"], name: "index_interactions_on_organization_id"
    t.index ["user_id"], name: "index_interactions_on_user_id"
  end

  create_table "labels", force: :cascade do |t|
    t.string "color"
    t.datetime "created_at", null: false
    t.string "name"
    t.datetime "updated_at", null: false
  end

  create_table "notes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "notable_id", null: false
    t.string "notable_type", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["notable_type", "notable_id"], name: "index_notes_on_notable"
    t.index ["user_id"], name: "index_notes_on_user_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.text "address"
    t.string "billing_email"
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "industry"
    t.string "name"
    t.text "notes"
    t.string "phone"
    t.string "tax_id"
    t.datetime "updated_at", null: false
    t.string "website"
  end

  create_table "pipeline_stages", force: :cascade do |t|
    t.string "color"
    t.datetime "created_at", null: false
    t.string "name"
    t.bigint "pipeline_id", null: false
    t.integer "position"
    t.float "probability"
    t.datetime "updated_at", null: false
    t.index ["pipeline_id"], name: "index_pipeline_stages_on_pipeline_id"
  end

  create_table "pipelines", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "default"
    t.text "description"
    t.string "name"
    t.datetime "updated_at", null: false
  end

  create_table "project_members", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "project_id", null: false
    t.string "role"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["project_id", "user_id"], name: "index_project_members_on_project_id_and_user_id", unique: true
    t.index ["project_id"], name: "index_project_members_on_project_id"
    t.index ["user_id"], name: "index_project_members_on_user_id"
  end

  create_table "projects", force: :cascade do |t|
    t.date "actual_end_date"
    t.decimal "budget"
    t.string "code"
    t.datetime "created_at", null: false
    t.string "currency"
    t.bigint "deal_id", null: false
    t.text "description"
    t.string "name"
    t.bigint "organization_id", null: false
    t.bigint "project_manager_id"
    t.integer "project_type"
    t.date "start_date"
    t.integer "status"
    t.date "target_end_date"
    t.datetime "updated_at", null: false
    t.index ["deal_id"], name: "index_projects_on_deal_id"
    t.index ["organization_id"], name: "index_projects_on_organization_id"
    t.index ["project_manager_id"], name: "index_projects_on_project_manager_id"
  end

  create_table "quotation_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.decimal "line_total"
    t.string "name"
    t.integer "position"
    t.decimal "quantity"
    t.bigint "quotation_id", null: false
    t.bigint "service_id", null: false
    t.decimal "unit_price"
    t.string "unit_type"
    t.datetime "updated_at", null: false
    t.index ["quotation_id"], name: "index_quotation_items_on_quotation_id"
    t.index ["service_id"], name: "index_quotation_items_on_service_id"
  end

  create_table "quotations", force: :cascade do |t|
    t.bigint "contact_id"
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.string "currency", default: "EUR"
    t.bigint "deal_id"
    t.decimal "discount_amount", precision: 12, scale: 2, default: "0.0"
    t.text "introduction"
    t.string "number", null: false
    t.bigint "organization_id", null: false
    t.string "public_token"
    t.integer "status", default: 0
    t.decimal "subtotal", precision: 12, scale: 2
    t.decimal "tax_amount", precision: 12, scale: 2
    t.decimal "tax_rate", precision: 5, scale: 2, default: "22.0"
    t.text "terms_and_conditions"
    t.string "title", null: false
    t.decimal "total", precision: 12, scale: 2
    t.datetime "updated_at", null: false
    t.date "valid_until"
    t.integer "version", default: 1
    t.index ["contact_id"], name: "index_quotations_on_contact_id"
    t.index ["created_by_id"], name: "index_quotations_on_created_by_id"
    t.index ["deal_id"], name: "index_quotations_on_deal_id"
    t.index ["number"], name: "index_quotations_on_number", unique: true
    t.index ["organization_id"], name: "index_quotations_on_organization_id"
    t.index ["public_token"], name: "index_quotations_on_public_token", unique: true
  end

  create_table "services", force: :cascade do |t|
    t.boolean "active"
    t.integer "category"
    t.string "code"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name"
    t.decimal "unit_price"
    t.string "unit_type"
    t.datetime "updated_at", null: false
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "ip_address"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "signatures", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "quotation_id", null: false
    t.text "signature_data"
    t.string "signature_type"
    t.datetime "signed_at"
    t.string "signer_email"
    t.string "signer_ip"
    t.string "signer_name"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.index ["quotation_id"], name: "index_signatures_on_quotation_id"
  end

  create_table "task_boards", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name"
    t.integer "position"
    t.bigint "project_id", null: false
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_task_boards_on_project_id"
  end

  create_table "task_columns", force: :cascade do |t|
    t.string "color"
    t.datetime "created_at", null: false
    t.string "name"
    t.integer "position"
    t.bigint "task_board_id", null: false
    t.datetime "updated_at", null: false
    t.integer "wip_limit"
    t.index ["task_board_id"], name: "index_task_columns_on_task_board_id"
  end

  create_table "task_labels", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "label_id", null: false
    t.bigint "task_id", null: false
    t.datetime "updated_at", null: false
    t.index ["label_id"], name: "index_task_labels_on_label_id"
    t.index ["task_id", "label_id"], name: "index_task_labels_on_task_id_and_label_id", unique: true
    t.index ["task_id"], name: "index_task_labels_on_task_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.integer "actual_hours"
    t.bigint "assigned_to_id"
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.text "description"
    t.date "due_date"
    t.integer "estimated_hours"
    t.integer "position"
    t.integer "priority"
    t.bigint "task_column_id", null: false
    t.string "title"
    t.datetime "updated_at", null: false
    t.index ["assigned_to_id"], name: "index_tasks_on_assigned_to_id"
    t.index ["created_by_id"], name: "index_tasks_on_created_by_id"
    t.index ["task_column_id"], name: "index_tasks_on_task_column_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email_address"
    t.string "name"
    t.string "password_digest"
    t.integer "role"
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "contacts", "organizations"
  add_foreign_key "deals", "contacts"
  add_foreign_key "deals", "organizations"
  add_foreign_key "deals", "pipeline_stages"
  add_foreign_key "deals", "users", column: "assigned_to_id"
  add_foreign_key "interactions", "contacts"
  add_foreign_key "interactions", "deals"
  add_foreign_key "interactions", "organizations"
  add_foreign_key "interactions", "users"
  add_foreign_key "notes", "users"
  add_foreign_key "pipeline_stages", "pipelines"
  add_foreign_key "project_members", "projects"
  add_foreign_key "project_members", "users"
  add_foreign_key "projects", "deals"
  add_foreign_key "projects", "organizations"
  add_foreign_key "projects", "users", column: "project_manager_id"
  add_foreign_key "quotation_items", "quotations"
  add_foreign_key "quotation_items", "services"
  add_foreign_key "quotations", "contacts"
  add_foreign_key "quotations", "deals"
  add_foreign_key "quotations", "organizations"
  add_foreign_key "quotations", "users", column: "created_by_id"
  add_foreign_key "sessions", "users"
  add_foreign_key "signatures", "quotations"
  add_foreign_key "task_boards", "projects"
  add_foreign_key "task_columns", "task_boards"
  add_foreign_key "task_labels", "labels"
  add_foreign_key "task_labels", "tasks"
  add_foreign_key "tasks", "task_columns"
  add_foreign_key "tasks", "users", column: "assigned_to_id"
  add_foreign_key "tasks", "users", column: "created_by_id"
end
