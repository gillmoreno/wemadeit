class User < ApplicationRecord
  has_secure_password
  has_many :sessions, dependent: :destroy

  # CRM associations
  has_many :assigned_deals, class_name: "Deal", foreign_key: "assigned_to_id", dependent: :restrict_with_error
  has_many :interactions, dependent: :destroy
  has_many :notes, dependent: :destroy

  # Project associations
  has_many :managed_projects, class_name: "Project", foreign_key: "project_manager_id", dependent: :nullify
  has_many :project_memberships, class_name: "ProjectMember", dependent: :destroy
  has_many :projects, through: :project_memberships
  has_many :assigned_tasks, class_name: "Task", foreign_key: "assigned_to_id", dependent: :nullify
  has_many :created_tasks, class_name: "Task", foreign_key: "created_by_id", dependent: :restrict_with_error

  # Quotation associations
  has_many :created_quotations, class_name: "Quotation", foreign_key: "created_by_id", dependent: :restrict_with_error

  enum :role, { admin: 0, sales: 1, project_manager: 2, developer: 3 }

  normalizes :email_address, with: ->(e) { e.strip.downcase }

  validates :email_address, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :role, presence: true

  def initials
    name.split.map(&:first).join.upcase
  end
end
