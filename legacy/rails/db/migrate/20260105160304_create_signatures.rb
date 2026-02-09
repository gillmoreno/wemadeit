class CreateSignatures < ActiveRecord::Migration[8.1]
  def change
    create_table :signatures do |t|
      t.references :quotation, null: false, foreign_key: true
      t.string :signer_name
      t.string :signer_email
      t.string :signer_ip
      t.text :signature_data
      t.string :signature_type
      t.datetime :signed_at
      t.string :user_agent

      t.timestamps
    end
  end
end
