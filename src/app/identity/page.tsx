import { getCurrentUser } from "../../lib/identity";
import { getAccountsByUserId } from "../../db/queries/users";
import { signIn, signOut } from "../../auth";
import { ProfileForm } from "../components/ProfileForm";
import { SignInButton } from "../components/SignInButton";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  twitter: "𝕏",
  github: "GitHub",
};

export default async function IdentityPage() {
  const user = await getCurrentUser();

  const signInAction = async () => {
    "use server";
    await signIn("twitter", { redirectTo: "/identity" });
  };

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/identity" });
  };

  if (!user) {
    return (
      <section className="id-page">
        <h1 className="disp">登录<br/><em>参与竞猜</em> 🥤</h1>
        <p className="lead">用 X（Twitter）账号登录，自动带入头像和昵称，登录后可改昵称。</p>
        <form action={signInAction} style={{ paddingTop: 32 }}>
          <SignInButton />
        </form>
      </section>
    );
  }

  const accounts = getAccountsByUserId(user.id);

  return (
    <section className="id-page">
      <h1 className="disp">你的<br/><em>身份</em> 🎭</h1>
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
