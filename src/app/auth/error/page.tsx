import Link from "next/link";
import { cookies } from "next/headers";
import { AUTH_ERROR_COOKIE, decodeAuthError } from "../../../lib/authError";

export const dynamic = "force-dynamic";

const linkAsCta = {
  display: "block",
  textAlign: "center" as const,
  textDecoration: "none",
};

function formatBeijingTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function AuthErrorPage() {
  const reason = decodeAuthError(
    (await cookies()).get(AUTH_ERROR_COOKIE)?.value,
  );

  if (reason?.kind === "suspended") {
    return (
      <section className="id-page">
        <h1 className="disp">无法<br /><em>登录</em> 🚫</h1>
        <p className="lead">
          你用来登录的 X（Twitter）账号已被 X 判定为「冻结 / 封禁」(suspended)，
          X 拒绝提供该账号资料，因此无法完成登录。
        </p>
        <p className="lead">
          解决办法：换一个状态正常的 X 账号登录；或前往 x.com 查看该账号的封禁原因并申诉解封后再来。
        </p>
        <Link href="/identity" className="cta" style={linkAsCta}>
          返回登录
        </Link>
      </section>
    );
  }

  if (reason?.kind === "rate_limited") {
    return (
      <section className="id-page">
        <h1 className="disp">登录<br /><em>暂时受限</em> 🥤</h1>
        <p className="lead">
          X 对登录接口做了频率限制，刚才的请求触发了上限——
          通常是短时间内反复点击登录、或多人同时登录导致的。
        </p>
        <p className="lead">
          请在 <strong>北京时间 {formatBeijingTime(reason.resetEpoch)}</strong> 之后再回来登录。
          届时额度会自动恢复，点一次按钮、耐心等待跳转即可，不要重复点击。
        </p>
        <Link href="/identity" className="cta" style={linkAsCta}>
          返回登录
        </Link>
      </section>
    );
  }

  return (
    <section className="id-page">
      <h1 className="disp">登录<br /><em>出错了</em></h1>
      <p className="lead">
        登录握手没完成，通常是重复点击或登录页停留太久导致的。请
        <strong>点一次下面的按钮重新登录、并耐心等待跳转</strong>，不要连续点击。
      </p>
      <p className="lead">
        若仍然失败，清除本站 Cookie（或换用无痕窗口）后再试一次即可；反复不行请联系管理员。
      </p>
      <Link href="/identity" className="cta" style={linkAsCta}>
        重新登录
      </Link>
    </section>
  );
}
