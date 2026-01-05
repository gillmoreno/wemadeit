class TaskBoard < ApplicationRecord
  belongs_to :project
  has_many :task_columns, -> { order(:position) }, dependent: :destroy
  has_many :tasks, through: :task_columns

  validates :name, presence: true

  after_create :create_default_columns

  private

  def create_default_columns
    [
      { name: "To Do", position: 0, color: "#9CA3AF" },
      { name: "In Progress", position: 1, color: "#3B82F6" },
      { name: "Review", position: 2, color: "#F59E0B" },
      { name: "Done", position: 3, color: "#10B981" }
    ].each do |column_attrs|
      task_columns.create!(column_attrs)
    end
  end
end
