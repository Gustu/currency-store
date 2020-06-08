export interface SellTransactionSummary {
  tx: string;
  currency: string;
  result: number;
}

type PartialSellTransaction = {
  tx: string;
  from: string;
  amount: number;
  price: number;
};

export type StoreTransaction = BuyTransaction & {
  remaining: number;
  sellTransactions: PartialSellTransaction[];
};

export interface BuyTransaction {
  tx: string;
  we_buy: number;
  currency: string;
  price: number;
}

export interface SellTransaction {
  tx: string;
  we_sell: number;
  currency: string;
  price: number;
}

export type Transaction = BuyTransaction | SellTransaction;
