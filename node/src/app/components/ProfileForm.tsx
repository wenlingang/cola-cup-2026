"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const EMOJI_CHOICES = [
  "🦁", "🐯", "🐼", "🦊", "🐸", "🐙", "🦅", "🐺",
  "🦈", "🐲", "🦄", "🐢", "🐝", "🦖", "🐧", "🦉",
  "👑", "🚀", "⚡", "🔥", "🌟", "🎯", "🍺", "🥤",
];

export function ProfileForm({
  initialNickname,
  initialEmoji,
  avatarUrl,
}: {
  initialNickname: string;
  initialEmoji: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [nickname, setNickname] = useState(initialNickname);
  const [emoji, setEmoji] = useState<string | null>(initialEmoji);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  void avatarUrl;

  async function save() {
    setMsg(null);
    setSaving(true);
    const res = await fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, emoji }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.error ?? "保存失败");
      return;
    }
    const isFirstSetup = initialEmoji === null;
    setMsg(isFirstSetup ? "✅ 已保存，正在返回首页…" : "✅ 已保存");
    startTransition(() => {
      router.refresh();
      if (isFirstSetup) router.push("/");
    });
  }

  const dirty = nickname !== initialNickname || emoji !== initialEmoji;

  return (
    <div className="id-form">
      <div className="preview">
        <span className="em">{emoji ?? "👤"}</span>
        <span>
          <div className="nm">{nickname || "你"}</div>
          <div className="label">头像预览</div>
        </span>
      </div>

      <label className="row" htmlFor="nick">昵称</label>
      <input
        id="nick"
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={16}
        placeholder="给自己起个名字"
      />

      <label className="row" style={{ marginTop: 24 }}>选个头像 emoji</label>
      <div className="emoji-grid">
        {EMOJI_CHOICES.map((e) => (
          <button key={e} type="button" className={emoji === e ? "sel" : ""} onClick={() => setEmoji(e === emoji ? null : e)}>{e}</button>
        ))}
      </div>

      {msg && <p className={msg.startsWith("✅") ? "formmsg" : "formmsg formerror"}>{msg}</p>}

      <button type="button" className="cta" disabled={saving || !nickname.trim() || !dirty} onClick={save} style={{marginTop: 24}}>
        {saving ? "保存中…" : "🥤 保存"}
      </button>
    </div>
  );
}
