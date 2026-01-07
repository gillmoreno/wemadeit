class Interaction < ApplicationRecord
  belongs_to :user
  belongs_to :organization, optional: true
  belongs_to :contact, optional: true
  belongs_to :deal, optional: true

  has_one_attached :audio_file

  enum :interaction_type, { call: 0, email: 1, meeting: 2, note: 3 }
  enum :transcription_status, { pending: 0, processing: 1, completed: 2, failed: 3 }, prefix: :transcription

  # Alias for backward compatibility with views using interaction_date
  alias_attribute :interaction_date, :occurred_at
  alias_attribute :description, :body

  validates :interaction_type, presence: true
  validate :acceptable_audio_file

  scope :pending_follow_ups, -> {
    where(follow_up_completed: false)
      .where.not(follow_up_date: nil)
      .where("follow_up_date <= ?", Date.current)
  }

  scope :upcoming_follow_ups, -> {
    where(follow_up_completed: false)
      .where.not(follow_up_date: nil)
      .where("follow_up_date > ? AND follow_up_date <= ?", Date.current, 7.days.from_now)
  }

  scope :recent, -> { order(occurred_at: :desc) }

  before_validation :set_occurred_at, on: :create

  def complete_follow_up!
    update!(follow_up_completed: true)
  end

  def overdue_follow_up?
    follow_up_date && !follow_up_completed && follow_up_date < Date.current
  end

  def has_transcript?
    transcript.present? || cleaned_transcript.present?
  end

  def display_transcript
    cleaned_transcript.presence || transcript
  end

  def crm_context
    {
      contact: contact&.slice(:id, :first_name, :last_name, :email),
      organization: organization&.slice(:id, :name, :industry),
      deal: deal&.slice(:id, :title, :value, :status),
      recent_interactions: related_interactions.limit(5).map { |i|
        { type: i.interaction_type, subject: i.subject, occurred_at: i.occurred_at, body: i.body&.truncate(200) }
      }
    }
  end

  private

  def related_interactions
    Interaction.where(organization_id: organization_id)
      .or(Interaction.where(contact_id: contact_id))
      .where.not(id: id)
      .order(occurred_at: :desc)
  end

  def set_occurred_at
    self.occurred_at ||= Time.current
  end

  def acceptable_audio_file
    return unless audio_file.attached?

    acceptable_types = %w[audio/mpeg audio/mp3 audio/wav audio/x-wav audio/mp4 audio/m4a audio/webm]

    unless acceptable_types.include?(audio_file.content_type)
      errors.add(:audio_file, "must be an MP3, WAV, M4A, or WebM file")
    end

    if audio_file.byte_size > 100.megabytes
      errors.add(:audio_file, "must be less than 100MB")
    end
  end
end
