class Service < ApplicationRecord
  has_many :quotation_items, dependent: :nullify

  enum :category, { development: 0, design: 1, consulting: 2, support: 3 }

  validates :name, presence: true

  scope :active, -> { where(active: true) }

  before_validation :set_defaults, on: :create

  private

  def set_defaults
    self.active = true if active.nil?
  end
end
