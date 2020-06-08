import {
  BuyTransaction,
  SellTransaction,
  SellTransactionSummary,
  StoreTransaction,
  Transaction,
} from "./Transaction.ts";
import {
  calculateRemainingCurrency,
  calculateSellResults,
  CurrencyStorageSummary,
  sumUpRemaining,
} from "./StoreSummary.ts";

interface StoreSummary {
  transactions: SellTransactionSummary[];
  storage: CurrencyStorageSummary[];
  pending: SellTransaction[];
}

export interface Store {
  getSummary(): Promise<StoreSummary>;

  handleNewBuyTransaction(transaction: BuyTransaction): Promise<void>;

  handleNewSellTransaction(transaction: SellTransaction): Promise<void>;
}

export const StoreFactory = (): Store => {
  const pending: SellTransaction[] = [];
  const transactions: Map<string, Transaction> = new Map<string, Transaction>();
  const storeTransactions: StoreTransaction[] = [];
  let cursor = 0;

  const getSummary = async (): Promise<StoreSummary> => {
    const sellResults = calculateSellResults(storeTransactions, transactions);
    const remainingCurrencies = sumUpRemaining(storeTransactions);
    const storage = remainingCurrencies.currency === ""
      ? []
      : [remainingCurrencies];
    return { transactions: sellResults, storage, pending };
  };

  const addToPending = (transaction: SellTransaction) => {
    pending.push(transaction);
  };

  const addBuyTransaction = (transaction: BuyTransaction) => {
    storeTransactions.push(
      { ...transaction, remaining: transaction.we_buy, sellTransactions: [] },
    );
  };

  const tryToClearPending = () => {
    const remainingAmount = calculateRemainingCurrency(storeTransactions);
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const isEnoughForSellTransaction = remainingAmount < p.we_sell;
      if (isEnoughForSellTransaction) {
        continue;
      }
      pending.splice(i, 1);
      const addedToStore = handleSellTransaction(p);
      if (addedToStore) {
        tryToClearPending();
        break;
      }
    }
  };

  const handleSellTransaction = (transaction: SellTransaction): boolean => {
    const remainingAmount = calculateRemainingCurrency(storeTransactions);
    const isNotEnoughCurrencyForSell = transaction.we_sell > remainingAmount;

    if (isNotEnoughCurrencyForSell) {
      addToPending(transaction);
      return false;
    }

    let sellRemaining = transaction.we_sell;
    while (sellRemaining > 0 && storeTransactions.length > cursor) {
      const { sellTransactions } = storeTransactions[cursor];
      const isDividedTransaction =
        storeTransactions[cursor].remaining >= sellRemaining;

      if (isDividedTransaction) {
        sellTransactions.push(
          {
            tx: transaction.tx,
            from: storeTransactions[cursor].tx,
            amount: sellRemaining,
            price: storeTransactions[cursor].price /
              storeTransactions[cursor].we_buy,
          },
        );
        storeTransactions[cursor].remaining -= sellRemaining;
        sellRemaining = 0;
      } else {
        sellTransactions.push(
          {
            tx: transaction.tx,
            from: storeTransactions[cursor].tx,
            amount: storeTransactions[cursor].remaining,
            price: storeTransactions[cursor].price /
              storeTransactions[cursor].we_buy,
          },
        );
        sellRemaining -= storeTransactions[cursor].remaining;
        storeTransactions[cursor].remaining = 0;
      }

      cursor++;
    }

    return true;
  };

  const addTransaction = (transaction: Transaction) => {
    if (transactions.has(transaction.tx)) {
      throw new Error("Duplicated id");
    }
    transactions.set(transaction.tx, transaction);
  };

  const handleNewSellTransaction = async (
    transaction: SellTransaction,
  ): Promise<void> => {
    addTransaction(transaction);
    handleSellTransaction(transaction);
  };

  const handleNewBuyTransaction = async (
    transaction: BuyTransaction,
  ): Promise<void> => {
    addTransaction(transaction);
    addBuyTransaction(transaction);
    tryToClearPending();
    return;
  };

  return {
    handleNewSellTransaction,
    handleNewBuyTransaction,
    getSummary,
  };
};
