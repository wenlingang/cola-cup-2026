require "rails_helper"

RSpec.describe "Redemptions", type: :request do
  include Devise::Test::IntegrationHelpers

  let(:user) { create(:user) }

  # Grant a settled betting balance via a ledger entry's delta
  # (net_balance = Σ ledger delta − Σ redemption cost).
  def grant_balance(amount)
    create(:ledger_entry, user: user, delta: amount)
  end

  def redeem(drink:, qty:)
    post redemptions_path,
      params: { drink: drink, qty: qty },
      headers: { "Accept" => "text/vnd.turbo-stream.html" }
  end

  context "when not signed in" do
    it "redirects to the identity prompt" do
      redeem(drink: "cola", qty: 1)
      expect(response).to redirect_to(identity_path)
    end
  end

  context "when signed in" do
    before { sign_in user }

    it "redeems when the balance exactly covers the cost (EPSILON boundary)" do
      grant_balance(1.0) # one cola costs exactly 1.0

      expect { redeem(drink: "cola", qty: 1) }.to change(Redemption, :count).by(1)

      expect(response).to have_http_status(:ok)
      redemption = Redemption.last
      expect(redemption.drink).to eq("cola")
      expect(redemption.qty).to eq(1)
      expect(redemption.cost).to eq(1.0)
      expect(response.body).to include("me_balance", "redeem_panel", "redemption_records")
    end

    it "deducts multi-bottle cost and zeroes the balance" do
      grant_balance(5.0)

      redeem(drink: "redbull", qty: 2) # 2.5 × 2 = 5.0

      expect(response).to have_http_status(:ok)
      expect(Redemption.last.cost).to eq(5.0)
      expect(user.reload.net_balance).to eq(0.0)
    end

    it "allows redeeming past the balance (it just goes negative)" do
      grant_balance(0.5)

      expect { redeem(drink: "cola", qty: 1) }.to change(Redemption, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(user.reload.net_balance).to be_within(1e-9).of(-0.5)
    end

    it "rejects a non-positive quantity" do
      grant_balance(10.0)

      expect { redeem(drink: "cola", qty: 0) }.not_to change(Redemption, :count)

      expect(response).to have_http_status(422)
      expect(response.body).to include("兑换数量需为正整数")
    end

    it "rejects a non-integer quantity" do
      grant_balance(10.0)

      expect { redeem(drink: "cola", qty: "2.5") }.not_to change(Redemption, :count)

      expect(response).to have_http_status(422)
      expect(response.body).to include("兑换数量需为正整数")
    end

    it "rejects an unknown drink" do
      grant_balance(10.0)

      expect { redeem(drink: "espresso", qty: 1) }.not_to change(Redemption, :count)

      expect(response).to have_http_status(422)
      expect(response.body).to include("未知饮料")
    end
  end
end
