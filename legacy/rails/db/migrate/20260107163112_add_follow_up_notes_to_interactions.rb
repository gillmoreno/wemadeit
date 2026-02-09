class AddFollowUpNotesToInteractions < ActiveRecord::Migration[8.1]
  def change
    add_column :interactions, :follow_up_notes, :text
  end
end
