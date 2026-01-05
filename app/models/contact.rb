class Contact < ApplicationRecord
  belongs_to :organization
  has_many :deals, dependent: :nullify
  has_many :quotations, dependent: :nullify
  has_many :interactions, dependent: :destroy
  has_many :notes, as: :notable, dependent: :destroy

  validates :first_name, presence: true
  validates :last_name, presence: true

  normalizes :email, with: ->(e) { e&.strip&.downcase }

  scope :primary, -> { where(primary_contact: true) }

  # Access the text column (renamed to avoid conflict with notes association)
  def memo
    read_attribute(:notes)
  end

  def memo=(value)
    write_attribute(:notes, value)
  end

  def full_name
    "#{first_name} #{last_name}"
  end

  def display_name
    job_title.present? ? "#{full_name} (#{job_title})" : full_name
  end
end
