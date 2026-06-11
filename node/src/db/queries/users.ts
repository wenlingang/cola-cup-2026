import { db } from "../client";

export type User = {
  id: number;
  nickname: string;
  avatar_url: string | null;
  emoji: string | null;
  created_at: number;
  deleted_at: number | null;
};

export type Account = {
  id: number;
  user_id: number;
  provider: string;
  provider_account_id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: number;
};

export function getUserById(id: number): User | null {
  return (
    (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | User
      | undefined) ?? null
  );
}

export function getUserByProviderAccount(
  provider: string,
  providerAccountId: string,
): User | null {
  return (
    (db
      .prepare(
        `SELECT u.* FROM users u
         JOIN accounts a ON a.user_id = u.id
         WHERE a.provider = ? AND a.provider_account_id = ?`,
      )
      .get(provider, providerAccountId) as User | undefined) ?? null
  );
}

export function getAccountsByUserId(userId: number): Account[] {
  return db
    .prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at")
    .all(userId) as Account[];
}

/**
 * Link an OAuth identity to a user, creating the user on first login.
 * Provider handle/avatar are refreshed on every login; the user's edited
 * nickname/emoji are preserved, while the display avatar tracks the latest login.
 */
export function upsertOAuthUser(input: {
  provider: string;
  providerAccountId: string;
  username: string | null;
  name: string;
  avatarUrl: string | null;
}): User {
  const existing = getUserByProviderAccount(
    input.provider,
    input.providerAccountId,
  );
  if (existing) {
    db.prepare(
      `UPDATE accounts SET username = @username, avatar_url = @avatarUrl
       WHERE provider = @provider AND provider_account_id = @providerAccountId`,
    ).run({
      username: input.username,
      avatarUrl: input.avatarUrl,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    });
    db.prepare("UPDATE users SET avatar_url = @avatarUrl WHERE id = @id").run({
      avatarUrl: input.avatarUrl,
      id: existing.id,
    });
    return getUserById(existing.id)!;
  }

  const create = db.transaction(() => {
    const now = Date.now();
    const info = db
      .prepare(
        `INSERT INTO users (nickname, avatar_url, emoji, created_at)
         VALUES (@nickname, @avatarUrl, NULL, @now)`,
      )
      .run({ nickname: input.name, avatarUrl: input.avatarUrl, now });
    const userId = Number(info.lastInsertRowid);
    db.prepare(
      `INSERT INTO accounts
         (user_id, provider, provider_account_id, username, avatar_url, created_at)
       VALUES (@userId, @provider, @providerAccountId, @username, @avatarUrl, @now)`,
    ).run({
      userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      username: input.username,
      avatarUrl: input.avatarUrl,
      now,
    });
    return userId;
  });
  return getUserById(create())!;
}

const MAX_NICKNAME = 16;

/** Update editable profile. emoji=null clears the override (revert to provider photo). */
export function updateProfile(
  userId: number,
  nickname: string,
  emoji: string | null,
): void {
  const trimmed = nickname.trim().slice(0, MAX_NICKNAME);
  if (!trimmed) return;
  db.prepare("UPDATE users SET nickname = ?, emoji = ? WHERE id = ?").run(
    trimmed,
    emoji && emoji.trim() ? emoji.trim() : null,
    userId,
  );
}

export function listUsers(): User[] {
  return db.prepare("SELECT * FROM users ORDER BY created_at").all() as User[];
}

export type UserWithHandle = User & { handle: string | null };

export function listUsersWithHandles(): UserWithHandle[] {
  return db
    .prepare(
      `SELECT u.*,
              (SELECT a.username FROM accounts a
               WHERE a.user_id = u.id ORDER BY a.created_at LIMIT 1) AS handle
       FROM users u ORDER BY u.created_at`,
    )
    .all() as UserWithHandle[];
}

/** Hide the user from the leaderboard, odds, vote rosters and settlement,
 *  and block their login. Reversible via restoreUser. */
export function softDeleteUser(userId: number): void {
  db.prepare(
    "UPDATE users SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
  ).run(Date.now(), userId);
}

export function restoreUser(userId: number): void {
  db.prepare("UPDATE users SET deleted_at = NULL WHERE id = ?").run(userId);
}
