class Task < ApplicationRecord
  belongs_to :task_column
  belongs_to :assigned_to, class_name: "User", optional: true
  belongs_to :created_by, class_name: "User"

  has_many :task_labels, dependent: :destroy
  has_many :labels, through: :task_labels

  enum :priority, { low: 0, medium: 1, high: 2, urgent: 3 }

  validates :title, presence: true
  validates :position, presence: true, numericality: { only_integer: true }

  before_validation :set_position, on: :create

  scope :overdue, -> { where("due_date < ?", Date.current) }
  scope :due_soon, -> { where(due_date: Date.current..3.days.from_now) }
  scope :unassigned, -> { where(assigned_to: nil) }

  # Turbo Streams broadcasts
  after_create_commit -> { broadcast_append_later_to task_column.task_board }
  after_update_commit -> { broadcast_replace_later_to task_column.task_board }
  after_destroy_commit -> { broadcast_remove_to task_column.task_board }

  def task_board
    task_column.task_board
  end

  def project
    task_board.project
  end

  def overdue?
    due_date && due_date < Date.current
  end

  def move_to_column!(column, position = nil)
    update!(task_column: column, position: position || column.tasks.count)
  end

  private

  def set_position
    self.position ||= task_column&.tasks&.count || 0
  end
end
