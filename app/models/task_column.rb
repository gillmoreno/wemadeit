class TaskColumn < ApplicationRecord
  belongs_to :task_board
  has_many :tasks, -> { order(:position) }, dependent: :destroy

  validates :name, presence: true
  validates :position, presence: true, numericality: { only_integer: true }

  def at_wip_limit?
    return false unless wip_limit&.positive?
    tasks.count >= wip_limit
  end

  def project
    task_board.project
  end
end
