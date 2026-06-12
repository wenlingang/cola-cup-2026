class AddVolumeToPolyMarkets < ActiveRecord::Migration[8.1]
  def change
    add_column :poly_markets, :volume, :float
  end
end
