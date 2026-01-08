class RemoveOrganizationFromProjects < ActiveRecord::Migration[8.1]
  def change
    remove_foreign_key :projects, :organizations
    remove_column :projects, :organization_id, :bigint
  end
end
