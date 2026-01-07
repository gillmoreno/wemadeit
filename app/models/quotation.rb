class Quotation < ApplicationRecord
  belongs_to :organization
  belongs_to :contact, optional: true
  belongs_to :deal, optional: true
  belongs_to :created_by, class_name: "User"

  has_many :quotation_items, -> { order(:position) }, dependent: :destroy
  has_one :signature, dependent: :destroy

  accepts_nested_attributes_for :quotation_items, allow_destroy: true, reject_if: :all_blank

  enum :status, { draft: 0, sent: 1, viewed: 2, accepted: 3, declined: 4, expired: 5 }

  # Aliases for form params compatibility
  alias_attribute :subject, :title
  alias_attribute :terms, :terms_and_conditions

  def total_discount
    discount_amount || 0
  end

  validates :number, presence: true, uniqueness: true
  validates :title, presence: true
  validates :organization, presence: true
  validates :created_by, presence: true

  before_validation :generate_number, on: :create
  before_validation :generate_public_token, on: :create
  before_save :calculate_totals

  scope :recent, -> { order(created_at: :desc) }
  scope :pending, -> { where(status: [:sent, :viewed]) }

  def signed?
    signature.present?
  end

  def expired?
    valid_until && valid_until < Date.current
  end

  def can_be_signed?
    sent? || viewed?
  end

  def mark_as_viewed!
    viewed! if sent?
  end

  def accept!(signature_params)
    transaction do
      create_signature!(signature_params.merge(signed_at: Time.current))
      accepted!
    end
  end

  def duplicate
    new_quote = dup
    new_quote.number = nil
    new_quote.public_token = nil
    new_quote.status = :draft
    new_quote.version = (version || 1) + 1
    new_quote.signature = nil

    quotation_items.each do |item|
      new_quote.quotation_items.build(item.attributes.except("id", "quotation_id", "created_at", "updated_at"))
    end

    new_quote
  end

  def convert_to_project!
    return unless accepted?

    Project.create!(
      organization: organization,
      deal: deal,
      name: title,
      description: "Created from quotation #{number}",
      budget: total,
      currency: currency,
      status: :presales
    )
  end

  private

  def generate_number
    return if number.present?
    year = Date.current.year
    last_quote = Quotation.where("number LIKE ?", "QUO-#{year}-%").order(:number).last
    next_number = last_quote ? last_quote.number.split("-").last.to_i + 1 : 1
    self.number = "QUO-#{year}-#{next_number.to_s.rjust(3, '0')}"
  end

  def generate_public_token
    self.public_token ||= SecureRandom.urlsafe_base64(32)
  end

  def calculate_totals
    self.subtotal = quotation_items.sum(&:line_total)
    self.tax_amount = subtotal * (tax_rate / 100.0) if tax_rate
    self.total = subtotal + (tax_amount || 0) - (discount_amount || 0)
  end
end
