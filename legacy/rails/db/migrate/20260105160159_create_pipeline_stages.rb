class CreatePipelineStages < ActiveRecord::Migration[8.1]
  def change
    create_table :pipeline_stages do |t|
      t.references :pipeline, null: false, foreign_key: true
      t.string :name
      t.integer :position
      t.string :color
      t.float :probability

      t.timestamps
    end
  end
end
