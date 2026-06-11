"use client";

import { useFormStatus } from "react-dom";

export function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="cta"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "正在跳转 X…" : "𝕏 用 Twitter 登录"}
    </button>
  );
}
