class ChangeServiceIdNullableOnQuotationItems < ActiveRecord::Migration[8.1]
  def change
    change_column_null :quotation_items, :service_id, true
  end
end
