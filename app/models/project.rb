class Project < ApplicationRecord
  belongs_to :organization
  belongs_to :deal, optional: true
  belongs_to :project_manager, class_name: "User", optional: true

  has_many :project_members, dependent: :destroy
  has_many :team_members, through: :project_members, source: :user
  has_many :task_boards, -> { order(:position) }, dependent: :destroy
  has_many :tasks, through: :task_boards

  enum :project_type, { landing_page: 0, website: 1, ecommerce: 2, custom_app: 3 }
  enum :status, { presales: 0, active: 1, on_hold: 2, completed: 3, support: 4 }

  validates :name, presence: true

  before_validation :set_default_currency, on: :create
  before_create :generate_code

  scope :for_user, ->(user) {
    left_joins(:project_members)
      .where("projects.project_manager_id = ? OR project_members.user_id = ?", user.id, user.id)
      .distinct
  }

  def activate!
    update!(status: :active, start_date: Date.current) if presales?
  end

  def complete!
    update!(status: :completed, actual_end_date: Date.current) if active?
  end

  def move_to_support!
    update!(status: :support) if completed?
  end

  def on_track?
    return true unless target_end_date
    Date.current <= target_end_date
  end

  def progress_percentage
    return 0 if task_boards.empty?
    total_tasks = tasks.count
    return 0 if total_tasks.zero?
    completed_tasks = tasks.joins(:task_column).where(task_columns: { name: "Done" }).count
    ((completed_tasks.to_f / total_tasks) * 100).round
  end

  private

  def set_default_currency
    self.currency ||= "EUR"
  end

  def generate_code
    return if code.present?
    year = Date.current.year
    last_project = Project.where("code LIKE ?", "WMI-#{year}-%").order(:code).last
    next_number = last_project ? last_project.code.split("-").last.to_i + 1 : 1
    self.code = "WMI-#{year}-#{next_number.to_s.rjust(3, '0')}"
  end
end
