/** Redeemable drinks and their credit cost per bottle. Credits are denominated
 *  in 可乐 (1 credit = 1 cola); pricier drinks cost more per bottle. Single
 *  source of truth — edit here to change the menu or prices. */
export type Drink = {
  key: string;
  name: string;
  emoji: string;
  cost: number;
};

export const DRINKS: Drink[] = [
  { key: "cola", name: "可乐", emoji: "🥤", cost: 1 },
  { key: "icetea", name: "各种茶", emoji: "🧋", cost: 1.5 },
  { key: "alien", name: "外星人", emoji: "👽", cost: 1.5 },
  { key: "redbull", name: "红牛", emoji: "🐂", cost: 2.5 },
];

export function getDrink(key: string): Drink | undefined {
  return DRINKS.find((d) => d.key === key);
}
