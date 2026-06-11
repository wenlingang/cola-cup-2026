import { getCurrentUser } from "./identity";
import { getAccountsByUserId, type User } from "../db/queries/users";

function settlerHandles(): Set<string> {
  return new Set(
    (process.env.SETTLER_USERNAMES ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
  );
}

/** A settler is any logged-in user with a linked account whose provider handle
 *  or provider account id is listed in SETTLER_USERNAMES. */
export function isSettler(user: User | null): boolean {
  if (!user) return false;
  const handles = settlerHandles();
  if (handles.size === 0) return false;
  return getAccountsByUserId(user.id).some(
    (account) =>
      (!!account.username && handles.has(account.username.toLowerCase())) ||
      handles.has(account.provider_account_id.toLowerCase()),
  );
}

export async function getCurrentSettler(): Promise<User | null> {
  const user = await getCurrentUser();
  return isSettler(user) ? user : null;
}
