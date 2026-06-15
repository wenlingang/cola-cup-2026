require "rails_helper"

RSpec.describe User do
  describe "validations" do
    subject { build(:user) }

    it { is_expected.to validate_presence_of(:nickname) }
    it { is_expected.to validate_length_of(:nickname).is_at_most(16) }
  end

  describe "#net_balance" do
    it "is settled net (Σ delta) minus credits spent on drinks" do
      user = create(:user)
      create(:ledger_entry, user: user, delta: 3.0)
      create(:ledger_entry, user: user, delta: -1.0)
      create(:redemption, user: user, cost: 1.5)

      expect(user.net_balance).to be_within(1e-9).of(0.5)
    end
  end

  describe "soft delete" do
    it "marks and restores deleted_at and excludes from .active" do
      user = create(:user)
      user.soft_delete!
      expect(user.deleted?).to be(true)
      expect(User.active).not_to include(user)

      user.restore!
      expect(user.reload.deleted_at).to be_nil
      expect(User.active).to include(user)
    end
  end

  describe ".leaderboard" do
    it "ranks by total desc, then bets desc, then created_at; excludes soft-deleted" do
      leader = create(:user, created_at: 3.days.ago)
      runner_up = create(:user, created_at: 2.days.ago)
      hidden = create(:user, :deleted)

      create(:ledger_entry, user: leader, delta: 5.0, won: true)
      create(:ledger_entry, user: runner_up, delta: 2.0, won: true)
      create(:ledger_entry, user: runner_up, delta: 0.0, won: false)
      create(:ledger_entry, user: hidden, delta: 99.0, won: true)
      # Redemptions never lower the rank.
      create(:redemption, user: leader, cost: 4.0)

      board = User.leaderboard.to_a
      expect(board.map(&:id)).to eq([ leader.id, runner_up.id ])
      expect(board.first.total).to be_within(1e-9).of(5.0)
      expect(board.first.redeemed).to be_within(1e-9).of(4.0)
      expect(board.last.bets).to eq(2)
      expect(board.map(&:id)).not_to include(hidden.id)
    end
  end

  # The test env cache is :null_store (never caches), so swap in a real store to
  # exercise the signature-keyed caching and its self-invalidation.
  describe ".leaderboard caching" do
    let(:store) { ActiveSupport::Cache::MemoryStore.new }

    before { allow(Rails).to receive(:cache).and_return(store) }

    it "returns Entry value objects whose to_param routes to the user" do
      user = create(:user)
      create(:ledger_entry, user: user, delta: 4.0, won: true)

      entry = User.leaderboard.first
      expect(entry).to be_a(User::Entry)
      expect(entry.to_param).to eq(user.id.to_s)
      expect(entry.total).to be_within(1e-9).of(4.0)
    end

    it "self-invalidates when a settlement inserts ledger rows via insert_all" do
      user = create(:user)
      create(:ledger_entry, user: user, delta: 2.0, won: true)
      expect(User.leaderboard.first.total).to be_within(1e-9).of(2.0)

      # Mirrors Settlement#write_ledger, which bypasses model callbacks.
      match = create(:match)
      LedgerEntry.insert_all([ {
        match_id: match.id, user_id: user.id, pick: "home", stake: 1.0,
        d_used: 2.0, won: true, delta: 3.0,
        created_at: Time.current, updated_at: Time.current
      } ])

      expect(User.leaderboard.first.total).to be_within(1e-9).of(5.0)
    end

    it "self-invalidates on a redemption and on a nickname edit" do
      user = create(:user, nickname: "旧名")
      create(:ledger_entry, user: user, delta: 1.0)
      expect(User.leaderboard.first.redeemed).to eq(0.0)

      create(:redemption, user: user, cost: 2.5)
      expect(User.leaderboard.first.redeemed).to be_within(1e-9).of(2.5)

      user.update!(nickname: "新名")
      expect(User.leaderboard.first.nickname).to eq("新名")
    end
  end

  describe "#settler?" do
    around do |example|
      original = ENV["SETTLER_USERNAMES"]
      example.run
      ENV["SETTLER_USERNAMES"] = original
    end

    it "is true when a linked account handle matches SETTLER_USERNAMES (@/case-insensitive)" do
      ENV["SETTLER_USERNAMES"] = "@Messi, other"
      user = create(:user)
      create(:account, user: user, username: "messi")

      expect(user.settler?).to be(true)
    end

    it "matches on the provider account id too" do
      ENV["SETTLER_USERNAMES"] = "12345"
      user = create(:user)
      create(:account, user: user, username: "nomatch", provider_account_id: "12345")

      expect(user.settler?).to be(true)
    end

    it "is false with no configured settlers" do
      ENV["SETTLER_USERNAMES"] = ""
      user = create(:user)
      create(:account, user: user, username: "messi")

      expect(user.settler?).to be(false)
    end
  end
end
