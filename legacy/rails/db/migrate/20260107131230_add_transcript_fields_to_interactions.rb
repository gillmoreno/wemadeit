class AddTranscriptFieldsToInteractions < ActiveRecord::Migration[8.1]
  def change
    add_column :interactions, :transcript, :text
    add_column :interactions, :cleaned_transcript, :text
    add_column :interactions, :transcription_status, :integer, default: 0
    add_column :interactions, :transcription_language, :string, default: "it"
  end
end
