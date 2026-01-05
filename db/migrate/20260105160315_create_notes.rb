class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes do |t|
      t.references :user, null: false, foreign_key: true
      t.references :notable, polymorphic: true, null: false
      t.string :title

      t.timestamps
    end
  end
end
