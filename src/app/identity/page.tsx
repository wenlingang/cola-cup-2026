import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/identity";
import { signIn } from "../../auth";
import { SignInButton } from "../components/SignInButton";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const user = await getCurrentUser();

  if (user) {
    // New users (emoji not chosen yet) set up their profile first; everyone else lands on the ledger.
    redirect(user.emoji === null ? "/me/settings" : "/me");
  }

  const signInAction = async () => {
    "use server";
    await signIn("twitter", { redirectTo: "/identity" });
  };

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
