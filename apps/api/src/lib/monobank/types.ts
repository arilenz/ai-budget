export type CurrencyRate = {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateBuy?: number;
  rateSell?: number;
  rateCross?: number;
};

export type ClientAccountType =
  | "black"
  | "white"
  | "platinum"
  | "iron"
  | "fop"
  | "yellow"
  | "eAid";

export type CashbackType = "None" | "UAH" | "Miles";

export type ClientAccount = {
  id: string;
  sendId: string;
  currencyCode: number;
  cashbackType: CashbackType;
  balance: number;
  creditLimit: number;
  maskedPan: Array<string>;
  type: ClientAccountType;
  iban: string;
};

export type ClientJar = {
  id: string;
  sendId: string;
  title: string;
  description: string;
  currencyCode: number;
  balance: number;
  goal?: number;
};

export type ClientInfo = {
  clientId: string;
  name: string;
  webHookUrl: string;
  permissions: string;
  accounts: Array<ClientAccount>;
  jars?: Array<ClientJar>;
};

export type StatementItem = {
  id: string;
  time: number;
  description: string;
  mcc: number;
  originalMcc: number;
  hold: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
};

export type WebhookPayload = {
  type: "StatementItem";
  data: {
    account: string;
    statementItem: StatementItem;
  };
};
