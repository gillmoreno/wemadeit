class ProjectMember < ApplicationRecord
  belongs_to :project
  belongs_to :user

  validates :user_id, uniqueness: { scope: :project_id, message: "is already a member of this project" }
end
