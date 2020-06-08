import {
  SellTransactionSummary,
  StoreTransaction,
  Transaction,
} from "./Transaction.ts";
import { SellTransaction } from "./Transaction.ts";

export interface CurrencyStorageSummary {
  currency: string;
  amount: number;
  equivalent: number;
}

const findSellTransaction = (
  transactions: Map<string, Transaction>,
  tx: string,
): SellTransaction | undefined => {
  const t = transactions.get(tx);
  return t && "we_sell" in t ? t : undefined;
};

export const calculateRemainingCurrency = (
  storeTransactions: StoreTransaction[],
) => {
  return storeTransactions.reduce((acc, t) => acc + t.remaining, 0);
};

export const calculateSellResults = (
  storeTransactions: StoreTransaction[],
  transactions: Map<string, Transaction>,
): SellTransactionSummary[] => {
  const pricesFromBuy: Map<string, { tx: string; paid: number }> =
    storeTransactions
      .flatMap((t) => t.sellTransactions)
      .reduce((acc, t) => {
        const transactionSummary = acc.get(t.tx);
        if (transactionSummary) {
          acc.set(
            t.tx,
            { tx: t.tx, paid: transactionSummary.paid + t.amount * t.price },
          );
        } else {
          acc.set(t.tx, { tx: t.tx, paid: t.amount * t.price });
        }
        return acc;
      }, new Map<string, { tx: string; paid: number }>());

  return Array.from(pricesFromBuy)
    .map(([key, value]) => {
      const t = findSellTransaction(transactions, key);
      if (!t) {
        throw new Error("Missing transaction");
      }
      return {
        tx: key,
        currency: t.currency,
        result: t.price - value.paid,
      };
    });
};

export const sumUpRemaining = (
  storeTransactions: StoreTransaction[],
): CurrencyStorageSummary => {
  return storeTransactions.reduce((acc, t) => {
    return ({
      currency: t.currency, // TODO: Multi-currency store
      amount: acc.amount + t.remaining,
      equivalent: acc.equivalent + t.remaining * (t.price / t.we_buy),
    });
  }, { amount: 0, currency: "", equivalent: 0 }); // TODO: Multi-currency store
};
