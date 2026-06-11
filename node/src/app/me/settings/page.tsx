import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/identity";
import { getAccountsByUserId } from "../../../db/queries/users";
import { signOut } from "../../../auth";
import { ProfileForm } from "../../components/ProfileForm";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  twitter: "𝕏",
  github: "GitHub",
};

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/identity");
  }

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/identity" });
  };

  const accounts = getAccountsByUserId(user.id);

  return (
    <section className="id-page">
      {accounts.map((account) => (
        <p key={account.id} className="lead">
          已用 {PROVIDER_LABELS[account.provider] ?? account.provider} 登录
          {account.username ? ` · @${account.username}` : ""}
        </p>
      ))}
      <ProfileForm initialNickname={user.nickname} initialEmoji={user.emoji} avatarUrl={user.avatar_url} />
      <form action={signOutAction} className="signout">
        <button type="submit">退出登录</button>
      </form>
    </section>
  );
}
