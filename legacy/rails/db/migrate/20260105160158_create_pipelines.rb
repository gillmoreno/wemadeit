class CreatePipelines < ActiveRecord::Migration[8.1]
  def change
    create_table :pipelines do |t|
      t.string :name
      t.text :description
      t.boolean :default

      t.timestamps
    end
  end
end
