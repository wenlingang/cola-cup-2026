require "rails_helper"

RSpec.describe "Admin::Jobs dashboard", type: :request do
  let(:settler) { create(:user) }

  around do |example|
    original = ENV["SETTLER_USERNAMES"]
    ENV["SETTLER_USERNAMES"] = "boss"
    example.run
    ENV["SETTLER_USERNAMES"] = original
  end

  def sign_in_settler
    create(:account, user: settler, username: "boss")
    sign_in settler
  end

  describe "access control (reuses the settler-only admin gate)" do
    it "renders the locked page (403) for an anonymous visitor" do
      get "/admin/jobs"
      expect(response).to have_http_status(:forbidden)
      expect(response.body).to include("仅限结算账号")
    end

    it "renders the locked page (403) for a logged-in non-settler" do
      sign_in create(:user)
      get "/admin/jobs"
      expect(response).to have_http_status(:forbidden)
      expect(response.body).to include("仅限结算账号")
    end

    it "lets a settler through the admin gate (no HTTP Basic prompt)" do
      sign_in_settler
      get "/admin/jobs"
      expect(response).not_to have_http_status(:forbidden)
      expect(response).not_to have_http_status(:unauthorized)
    end
  end
end
