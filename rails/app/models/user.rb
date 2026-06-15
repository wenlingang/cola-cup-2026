class User < ApplicationRecord
  # database_authenticatable is only the Warden base — there is no password entry
  # (sessions/registrations/passwords routes are skipped); login is via OmniAuth
  # providers (Twitter/X and/or OIDC).
  devise :database_authenticatable, :rememberable, :omniauthable,
    omniauth_providers: [ :twitter2, :openid_connect ]

  MAX_NICKNAME = 16
  FALLBACK_NICKNAME = "球迷"
  # Maps the OmniAuth strategy name to the provider value stored on Account.
  # "twitter2" is normalised to "twitter" so legacy data / SETTLER_USERNAMES
  # matching stay unchanged.
  PROVIDERS = { "twitter2" => "twitter", "openid_connect" => "oidc" }.freeze

  LEADERBOARD_CACHE_KEY = "leaderboard/v1".freeze

  # One cached leaderboard row. Holds only primitives so it Marshals cleanly into
  # Solid Cache — caching the AR rows would drag along attribute/type metadata and
  # the virtual select columns. Exposes exactly the readers leaderboards/_board
  # uses; to_param keeps user_path(entry) generating /users/:id.
  Entry = Data.define(:id, :avatar_url, :emoji, :nickname, :total, :redeemed, :bets, :wins) do
    def to_param = id.to_s
  end

  has_many :accounts, dependent: :destroy
  has_many :votes, dependent: :destroy
  has_many :ledger_entries, dependent: :destroy
  has_many :redemptions, dependent: :destroy

  validates :nickname, presence: true, length: { maximum: MAX_NICKNAME }

  scope :active, -> { where(deleted_at: nil) }

  # Soft delete/restore changes who appears across the app; a nickname/emoji edit
  # only updates display. Avatar refreshes on login are intentionally not broadcast.
  after_commit :broadcast_user_change, on: :update

  def broadcast_user_change
    if saved_change_to_deleted_at?
      Broadcasts::UserVisibilityJob.perform_later(id)
    elsif saved_change_to_nickname? || saved_change_to_emoji?
      Broadcasts::ProfileJob.perform_later(id)
    end
  end

  # Leaderboard ranked by total score (Σ delta) — pure betting performance,
  # redemptions reported alongside but never lower the rank. Returns Entry rows
  # carrying total / redeemed / bets / wins; soft-deleted users are excluded.
  #
  # Cached in Solid Cache under a key stamped with leaderboard_signature, so the
  # cache self-invalidates whenever any input changes — no per-model hooks, which
  # matters because settlements write ledger rows via LedgerEntry.insert_all and
  # bypass callbacks. Both the leaderboard page and the broadcast job
  # (Broadcasts::Renderable#broadcast_leaderboard) call this and share the result.
  def self.leaderboard
    Rails.cache.fetch("#{LEADERBOARD_CACHE_KEY}/#{leaderboard_signature}", expires_in: 12.hours) do
      leaderboard_relation.map do |row|
        Entry.new(
          id: row.id, avatar_url: row.avatar_url, emoji: row.emoji, nickname: row.nickname,
          total: row.total.to_f, redeemed: row.redeemed.to_f, bets: row.bets.to_i, wins: row.wins.to_i
        )
      end
    end
  end

  def self.leaderboard_relation
    active
      .select(
        "users.id, users.avatar_url, users.emoji, users.nickname, users.created_at",
        "COALESCE((SELECT SUM(delta) FROM ledger_entries WHERE user_id = users.id), 0) AS total",
        "COALESCE((SELECT SUM(cost) FROM redemptions WHERE user_id = users.id), 0) AS redeemed",
        "(SELECT COUNT(*) FROM ledger_entries WHERE user_id = users.id) AS bets",
        "COALESCE((SELECT SUM(won) FROM ledger_entries WHERE user_id = users.id), 0) AS wins"
      )
      .order(Arel.sql("total DESC, bets DESC, users.created_at ASC"))
  end

  # Cheap signature that advances whenever a leaderboard input changes: ledger
  # inserts (incl. settlement's insert_all) and redemptions bump a max(:id);
  # nickname/emoji edits and soft delete/restore bump users.updated_at. Far
  # cheaper than the per-user correlated subqueries it guards.
  def self.leaderboard_signature
    [
      LedgerEntry.maximum(:id),
      Redemption.maximum(:id),
      User.maximum(:updated_at).to_f,
      User.active.count
    ].join("-")
  end

  # Link an OAuth identity to a user, creating the user on first login. The
  # provider handle and avatar refresh on every login; the user's edited nickname
  # and emoji are never overwritten. Ports the legacy upsertOAuthUser.
  def self.from_omniauth(auth)
    provider = PROVIDERS.fetch(auth.provider.to_s)
    provider_account_id = auth.uid.to_s
    username = auth.info.nickname.presence
    avatar_url = avatar_for(auth.provider.to_s, auth.info.image)

    account = Account.find_by(provider: provider, provider_account_id: provider_account_id)
    if account
      account.update!(username: username, avatar_url: avatar_url)
      account.user.update!(avatar_url: avatar_url) # nickname / emoji untouched
      return account.user
    end

    transaction do
      user = create!(nickname: nickname_from(auth.info.name), avatar_url: avatar_url)
      user.accounts.create!(
        provider: provider, provider_account_id: provider_account_id,
        username: username, avatar_url: avatar_url
      )
      user
    end
  end

  # Twitter serves a 48px "_normal" avatar; request the 400px variant. Other
  # providers (e.g. the OIDC `picture` claim) are used as-is.
  def self.avatar_for(omniauth_provider, image)
    url = image.presence
    omniauth_provider == "twitter2" ? url&.sub("_normal", "_400x400") : url
  end

  def self.nickname_from(name)
    (name.presence || FALLBACK_NICKNAME).to_s[0, MAX_NICKNAME]
  end

  # Available balance = settled net (Σ ledger delta) − credits spent on drinks.
  def net_balance
    ledger_entries.sum(:delta) - redemptions.sum(:cost)
  end

  def soft_delete!
    update!(deleted_at: Time.current) if deleted_at.nil?
  end

  def restore!
    update!(deleted_at: nil)
  end

  def deleted?
    deleted_at.present?
  end

  def settler?
    Settler.settler?(self)
  end

  # Display handle for the admin roster — the earliest linked account's username.
  def primary_handle
    accounts.min_by(&:created_at)&.username
  end

  # Soft-deleted users cannot sign in (Devise checks this on every authentication).
  def active_for_authentication?
    super && !deleted?
  end

  def inactive_message
    deleted? ? :deleted_account : super
  end
end
