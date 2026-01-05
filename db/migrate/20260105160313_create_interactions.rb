class CreateInteractions < ActiveRecord::Migration[8.1]
  def change
    create_table :interactions do |t|
      t.references :user, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :deal, null: false, foreign_key: true
      t.integer :interaction_type
      t.string :subject
      t.text :body
      t.datetime :occurred_at
      t.integer :duration_minutes
      t.datetime :follow_up_date
      t.boolean :follow_up_completed

      t.timestamps
    end
  end
end
