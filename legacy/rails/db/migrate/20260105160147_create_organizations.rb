class CreateOrganizations < ActiveRecord::Migration[8.1]
  def change
    create_table :organizations do |t|
      t.string :name
      t.string :website
      t.string :industry
      t.string :phone
      t.string :email
      t.text :address
      t.string :tax_id
      t.string :billing_email
      t.text :notes

      t.timestamps
    end
  end
end
