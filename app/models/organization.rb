class Organization < ApplicationRecord
  has_many :contacts, dependent: :destroy
  has_many :deals, dependent: :destroy
  has_many :projects, dependent: :destroy
  has_many :quotations, dependent: :destroy
  has_many :interactions, dependent: :destroy

  validates :name, presence: true

  normalizes :email, with: ->(e) { e&.strip&.downcase }

  scope :with_open_deals, -> { joins(:deals).where(deals: { status: :open }).distinct }

  def primary_contact
    contacts.find_by(primary_contact: true) || contacts.first
  end

  def open_deals_value
    deals.open.sum(:value)
  end
end
