class CreateAiProviders < ActiveRecord::Migration[8.1]
  def change
    create_table :ai_providers do |t|
      t.string :name
      t.string :api_key_encrypted
      t.string :model
      t.boolean :active
      t.boolean :default
      t.jsonb :settings

      t.timestamps
    end
  end
end
