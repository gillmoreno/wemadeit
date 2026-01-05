class CreateContacts < ActiveRecord::Migration[8.1]
  def change
    create_table :contacts do |t|
      t.references :organization, null: false, foreign_key: true
      t.string :first_name
      t.string :last_name
      t.string :email
      t.string :phone
      t.string :mobile
      t.string :job_title
      t.string :linkedin_url
      t.boolean :primary_contact
      t.text :notes

      t.timestamps
    end
  end
end
