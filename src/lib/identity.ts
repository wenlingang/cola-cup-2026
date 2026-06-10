import { auth } from "../auth";
import { getUserById, type User } from "../db/queries/users";

export async function getCurrentUser(): Promise<User | null> {
  const session = await auth();
  if (typeof session?.uid !== "number") return null;
  const user = getUserById(session.uid);
  return user && user.deleted_at == null ? user : null;
}
