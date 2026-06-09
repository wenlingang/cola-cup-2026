import type { Metadata } from "next";

export const metadata: Metadata = { title: "说明 · CUP" };

export default function AboutPage() {
  return (
    <section>
      <div className="about">
        <h1 className="lead-h disp">
          不是赌博，<br />
          <em>是请客</em> 🥤
        </h1>
        <p className="intro">
          <b style={{ color: "var(--hi)" }}>
            CUP<span style={{ color: "var(--red)" }}>.</span>2026
          </b>{" "}
          是同事之间的世界杯预测小游戏 —— 赛前预测看好谁，赛后按大家的预测赔率结算。
          <b style={{ color: "var(--hi)" }}>不涉及真钱</b>，输赢都用饮料：猜错的人给大家买几瓶，仅此而已。
        </p>

        <div className="sec">
          <h2 className="disp">「可乐」只是计价单位</h2>
          <p className="sub">1 瓶 = 任意一瓶等价饮料，按喜好兑换</p>
          <div className="drinks">
            <div className="drink unit">
              <div className="em">🥤</div>
              <div className="dn">可口可乐</div>
              <div className="note">默认计价单位</div>
            </div>
            <div className="drink">
              <div className="em">🧊</div>
              <div className="dn">雪碧</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🍊</div>
              <div className="dn">芬达</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">💧</div>
              <div className="dn">脉动</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🐂</div>
              <div className="dn">红牛</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">⚡</div>
              <div className="dn">电解质水</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🧋</div>
              <div className="dn">冰红茶</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🍵</div>
              <div className="dn">绿茶</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🫧</div>
              <div className="dn">苏打水</div>
              <div className="note">1 : 1 等价</div>
            </div>
            <div className="drink">
              <div className="em">🍺</div>
              <div className="dn">啤酒</div>
              <div className="note">1 : 1 · 仅限下班后</div>
            </div>
          </div>
        </div>

        <div className="sec">
          <h2 className="disp">怎么玩</h2>
          <ol className="rules">
            <li>
              <span className="t">
                <b>赛前预测</b>，选主胜 / 平 / 客胜。<b>每场固定下注</b>，按阶段递增：小组赛 1 瓶、32/16/8 强 2 瓶、半决赛及之后 5 瓶。<small>开赛前可随时改预测。</small>
              </span>
            </li>
            <li>
              <span className="t">
                <b>开赛前 1 小时锁定</b>，结算赔率以同事预测为准。<small>Polymarket 市场数据全程仅作对比参考。</small>
              </span>
            </li>
            <li>
              <span className="t">
                <b>赛后结算</b>：猜中按赔率赢瓶，猜错按注额给大家买饮料。赢瓶以<b>小数累计</b>记在你账上。
              </span>
            </li>
            <li>
              <span className="t">
                <b>攒够才领</b>：账上<b>攒满 1 瓶即可领一瓶可乐</b>，零头继续累计。<small>没有平台抽水，可乐只在猜对和猜错的人之间流转。</small>
              </span>
            </li>
            <li>
              <span className="t">
                <b>想多押？</b>用多个账号参与即可，<b>一人多号不限制</b>。
              </span>
            </li>
          </ol>
        </div>

        <div className="sec">
          <h2 className="disp">数据来源</h2>
          <p className="sub">市场赔率来自 Polymarket，仅供对比；结算只看同事预测。</p>
          <div className="source">
            <a
              className="market-link"
              href="https://polymarket.com/sports/soccer/world-cup"
              target="_blank"
              rel="noopener noreferrer"
            >
              ⚽ 前往 Polymarket 市场数据 ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
