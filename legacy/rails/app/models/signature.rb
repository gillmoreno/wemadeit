class Signature < ApplicationRecord
  belongs_to :quotation

  validates :signer_name, presence: true
  validates :signer_email, presence: true
  validates :signature_data, presence: true
  validates :signed_at, presence: true

  enum :signature_type, { drawn: 0, typed: 1 }
end
