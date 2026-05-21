export const DEFAULT_CATEGORIES = [
  "Groceries",
  "Restaurants & Cafes",
  "Transport",
  "Fuel",
  "Travel",
  "Utilities & Telecom",
  "Health & Pharmacy",
  "Beauty & Personal Care",
  "Shopping",
  "Electronics & Home",
  "Entertainment",
  "Subscriptions & Digital",
  "Education",
  "Sports & Fitness",
  "Pets",
  "Charity & Donations",
  "Government & Taxes",
  "Financial Services",
  "Income",
  "Transfers",
  "Uncategorized",
] as const;

export type DefaultCategory = (typeof DEFAULT_CATEGORIES)[number];

export const UNCATEGORIZED: DefaultCategory = "Uncategorized";

const MCC_OVERRIDES: Record<number, DefaultCategory> = {
  5541: "Fuel",
  5542: "Fuel",
  5983: "Fuel",
  4411: "Travel",
  4511: "Travel",
  4722: "Travel",
  7512: "Travel",
  7032: "Travel",
  7033: "Travel",
  5912: "Health & Pharmacy",
  5975: "Health & Pharmacy",
  5976: "Health & Pharmacy",
  5977: "Beauty & Personal Care",
  5045: "Electronics & Home",
  5065: "Electronics & Home",
  5072: "Electronics & Home",
  5074: "Electronics & Home",
  5200: "Electronics & Home",
  5211: "Electronics & Home",
  5231: "Electronics & Home",
  5251: "Electronics & Home",
  5722: "Electronics & Home",
  5946: "Electronics & Home",
  5733: "Entertainment",
  5735: "Entertainment",
  5815: "Entertainment",
  5816: "Entertainment",
  5818: "Subscriptions & Digital",
  5817: "Subscriptions & Digital",
  2741: "Subscriptions & Digital",
  5192: "Subscriptions & Digital",
  5734: "Subscriptions & Digital",
  5942: "Subscriptions & Digital",
  5968: "Subscriptions & Digital",
  5940: "Sports & Fitness",
  5941: "Sports & Fitness",
  7941: "Sports & Fitness",
  7997: "Sports & Fitness",
  5995: "Pets",
};

const TRANSFER_MCCS: ReadonlySet<number> = new Set([4829, 6536, 6537, 6538]);

function rangeDefault(mcc: number): DefaultCategory | undefined {
  if (mcc >= 700 && mcc <= 999) return "Pets";
  if (mcc >= 1500 && mcc <= 2999) return "Shopping";
  if (mcc >= 3000 && mcc <= 3999) return "Travel";
  if (mcc >= 4000 && mcc <= 4799) return "Transport";
  if (mcc >= 4800 && mcc <= 4999) return "Utilities & Telecom";
  if (mcc >= 5000 && mcc <= 5399) return "Shopping";
  if (mcc >= 5400 && mcc <= 5499) return "Groceries";
  if (mcc >= 5500 && mcc <= 5599) return "Transport";
  if (mcc >= 5600 && mcc <= 5699) return "Shopping";
  if (mcc >= 5700 && mcc <= 5799) return "Electronics & Home";
  if (mcc >= 5800 && mcc <= 5899) return "Restaurants & Cafes";
  if (mcc >= 5900 && mcc <= 5999) return "Shopping";
  if (mcc >= 6000 && mcc <= 6999) return "Financial Services";
  if (mcc >= 7000 && mcc <= 7099) return "Travel";
  if (mcc >= 7100 && mcc <= 7299) return "Beauty & Personal Care";
  if (mcc >= 7300 && mcc <= 7399) return "Shopping";
  if (mcc >= 7500 && mcc <= 7599) return "Transport";
  if (mcc >= 7600 && mcc <= 7699) return "Electronics & Home";
  if (mcc >= 7800 && mcc <= 7999) return "Entertainment";
  if (mcc >= 8000 && mcc <= 8099) return "Health & Pharmacy";
  if (mcc >= 8100 && mcc <= 8199) return "Government & Taxes";
  if (mcc >= 8200 && mcc <= 8299) return "Education";
  if (mcc >= 8300 && mcc <= 8699) return "Charity & Donations";
  if (mcc >= 8700 && mcc <= 8999) return "Shopping";
  if (mcc >= 9000 && mcc <= 9999) return "Government & Taxes";
  return undefined;
}

export function categoryForMcc(
  mcc: number | null | undefined,
  amount: number,
): DefaultCategory {
  if (mcc == null || mcc === 0) return UNCATEGORIZED;
  if (TRANSFER_MCCS.has(mcc)) return amount > 0 ? "Income" : "Transfers";
  const override = MCC_OVERRIDES[mcc];
  if (override) return override;
  return rangeDefault(mcc) ?? UNCATEGORIZED;
}
