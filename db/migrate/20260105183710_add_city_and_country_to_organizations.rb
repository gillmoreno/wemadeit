class AddCityAndCountryToOrganizations < ActiveRecord::Migration[8.1]
  def change
    add_column :organizations, :city, :string
    add_column :organizations, :country, :string
  end
end
