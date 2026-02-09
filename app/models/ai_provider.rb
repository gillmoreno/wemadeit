class AiProvider < ApplicationRecord
  encrypts :api_key_encrypted
  store_accessor :settings, :base_url, :stt_model

  validates :name, presence: true, inclusion: { in: %w[anthropic openai groq] }

  scope :active, -> { where(active: true) }

  before_save :ensure_single_default

  def self.default
    find_by(default: true, active: true) || active.first
  end

  def anthropic?
    name == "anthropic"
  end

  def openai?
    name == "openai"
  end

  def groq?
    name == "groq"
  end

  # Alias methods for BaseService compatibility
  def provider_type
    name
  end

  def model_name
    model
  end

  def api_key
    api_key_encrypted
  end

  private

  def ensure_single_default
    return unless default? && default_changed?
    AiProvider.where.not(id: id).update_all(default: false)
  end
end
