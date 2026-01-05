class TaskLabel < ApplicationRecord
  belongs_to :task
  belongs_to :label

  validates :label_id, uniqueness: { scope: :task_id }
end
