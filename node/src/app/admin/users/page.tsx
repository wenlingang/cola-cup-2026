import { revalidatePath } from "next/cache";
import { getCurrentSettler } from "../../../lib/settler";
import {
  listUsersWithHandles,
  softDeleteUser,
  restoreUser,
} from "../../../db/queries/users";

export const dynamic = "force-dynamic";

async function toggleUserDeletedAction(formData: FormData) {
  "use server";
  const operator = await getCurrentSettler();
  if (!operator) return;

  const targetId = Number(formData.get("userId"));
  if (!Number.isInteger(targetId) || targetId === operator.id) return;

  if (formData.get("op") === "restore") {
    restoreUser(targetId);
  } else {
    softDeleteUser(targetId);
  }
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const settler = await getCurrentSettler();
  if (!settler) {
    return (
      <section className="adm-locked">
        <h1>⚙️ 用户管理</h1>
        <p>此页面仅限结算账号访问。</p>
        <p>请用结算账号登录后再来。</p>
      </section>
    );
  }

  const users = listUsersWithHandles();

  return (
    <section>
      <div className="adm-head">
        <h1>⚙️ 用户管理</h1>
        <p>
          删除为软删除：该用户将从排行榜、赔率和结算中消失，且无法登录；随时可恢复。
        </p>
      </div>
      <hr className="rule ink" />
      <div className="user-admin">
        <ul>
          {users.map((user) => (
            <li key={user.id} className={user.deleted_at ? "gone" : ""}>
              <span className="em">{user.emoji ?? "👤"}</span>
              <span className="who">
                <span className="nm">{user.nickname}</span>
                {user.handle && <span className="hd">@{user.handle}</span>}
              </span>
              {user.id === settler.id ? (
                <span className="self">本人</span>
              ) : (
                <form action={toggleUserDeletedAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    type="hidden"
                    name="op"
                    value={user.deleted_at ? "restore" : "delete"}
                  />
                  <button
                    type="submit"
                    className={user.deleted_at ? "restore" : "delete"}
                  >
                    {user.deleted_at ? "恢复" : "删除"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
