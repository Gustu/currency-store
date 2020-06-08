interface SellTransactionSummary {
  tx: string;
  currency: string;
  result: number;
}

interface CurrencyStorageSummary {
  currency: string;
  amount: number;
  equivalent: number;
}

interface StoreSummary {
  transactions: SellTransactionSummary[];
  storage: CurrencyStorageSummary[];
  pending: SellTransaction[];
}

type PartialSell = { tx: string; from: string; amount: number; price: number };

type StoreTransaction = BuyTransaction & {
  remaining: number;
  sellTransactions: PartialSell[];
};

interface BuyTransaction {
  tx: string;
  we_buy: number;
  currency: string;
  price: number;
}

interface SellTransaction {
  tx: string;
  we_sell: number;
  currency: string;
  price: number;
}

export type Transaction = BuyTransaction | SellTransaction;

interface Store {
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
    const transactions = getAllSells();
    const sum = sumUpRemaining();
    const storage = sum.currency === "" ? [] : [sum];
    return { transactions, storage, pending };
  };

  const addToPending = (transaction: SellTransaction) => {
    pending.push(transaction);
  };

  const addBuyTransaction = (transaction: BuyTransaction) => {
    storeTransactions.push(
      { ...transaction, remaining: transaction.we_buy, sellTransactions: [] },
    );
  };

  const findSellTransaction = (tx: string): SellTransaction | undefined => {
    const t = transactions.get(tx);
    return t && "we_sell" in t ? t : undefined;
  };

  const calculateRemainingCurrency = () => {
    return storeTransactions.reduce((acc, t) => acc + t.remaining, 0);
  };

  const getAllSells = (): SellTransactionSummary[] => {
    const buySummary: Map<string, { tx: string; paid: number }> =
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

    return Array.from(buySummary)
      .map(([key, value]) => {
        const t = findSellTransaction(key);
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

  const sumUpRemaining = (): CurrencyStorageSummary => {
    return storeTransactions.reduce((acc, t) => {
      return ({
        currency: t.currency, // TODO: Multi-currency store
        amount: acc.amount + t.remaining,
        equivalent: acc.equivalent + t.remaining * (t.price / t.we_buy),
      });
    }, { amount: 0, currency: "", equivalent: 0 }); // TODO: Multi-currency store
  };

  const tryToClearPending = () => {
    const remainingAmount = calculateRemainingCurrency();
    for (let i = 0; i < pending.length; i++) {
      let p = pending[i];
      if (remainingAmount < p.we_sell) {
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
    const remainingAmount = calculateRemainingCurrency();
    const isNotEnoughCurrencyForSell = transaction.we_sell > remainingAmount;

    if (isNotEnoughCurrencyForSell) {
      addToPending(transaction);
      return false;
    }

    let sellRemaining = transaction.we_sell;
    while (sellRemaining > 0 && storeTransactions.length > cursor) {
      const { sellTransactions } = storeTransactions[cursor];

      if (storeTransactions[cursor].remaining >= sellRemaining) {
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
