import { assert, assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { StoreFactory } from "./Store.ts";
import { Transaction } from "./Transaction.ts";

const getStoreWithTransactions = async (transactions: Transaction[]) => {
  const storage = StoreFactory();
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if ("we_buy" in t) {
      await storage.handleNewBuyTransaction(t);
    } else {
      await storage.handleNewSellTransaction(t);
    }
  }
  return storage;
};

Deno.test("should return EUR summary", async () => {
  //given
  const transactions = [
    { tx: "t1", we_buy: 1.00, currency: "EUR", price: 4.00 },
    { tx: "t2", we_buy: 1.00, currency: "EUR", price: 4.50 },
    { tx: "t3", we_buy: 2.00, currency: "EUR", price: 10.00 },
    { tx: "t4", we_buy: 2.00, currency: "EUR", price: 8.00 },
    { tx: "t5", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 1);
  const [firstTransaction] = result.transactions;
  assertEquals(firstTransaction.tx, "t5");
  assertEquals(firstTransaction.currency, "EUR");
  assertEquals(firstTransaction.result, 1.5);
  assertEquals(result.storage.length, 1);
  const [eurSummary] = result.storage;
  assertEquals(eurSummary.currency, "EUR");
  assertEquals(eurSummary.amount, 4.0);
  assertEquals(eurSummary.equivalent, 18.0);
  assertEquals(result.pending.length, 0);
});

Deno.test("should sum up store", async () => {
  //given
  const transactions = [
    { tx: "t5", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 0);
  assertEquals(result.storage.length, 0);
  assertEquals(result.pending.length, 1);
});

Deno.test("should have still one pending transaction when not enough in store", async () => {
  //given
  const transactions = [
    { tx: "t1", we_buy: 1.00, currency: "EUR", price: 4.00 },
    { tx: "t2", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 0);
  assertEquals(result.storage.length, 1);
  assertEquals(result.pending.length, 1);
});

Deno.test("should have loss", async () => {
  //given
  const transactions = [
    { tx: "t1", we_buy: 1.00, currency: "EUR", price: 4.00 },
    { tx: "t2", we_sell: 1.00, currency: "EUR", price: 4.50 },
    { tx: "t3", we_buy: 2.00, currency: "EUR", price: 10.00 },
    { tx: "t4", we_sell: 2.00, currency: "EUR", price: 8.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 2);
  const [first, second] = result.transactions;
  assertEquals(first.result, 0.5);
  assertEquals(second.result, -2.0);
  assertEquals(result.storage.length, 1);
  const [eurSummary] = result.storage;
  assertEquals(eurSummary.currency, "EUR");
  assertEquals(eurSummary.amount, 0);
  assertEquals(eurSummary.equivalent, 0);
  assertEquals(result.pending.length, 0);
});

Deno.test("should cover pending transaction with new buy transaction", async () => {
  //given
  const transactions = [
    { tx: "t5", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 0);
  assertEquals(result.storage.length, 0);
  assertEquals(result.pending.length, 1);

  //when
  await storage.handleNewBuyTransaction(
    { tx: "t6", we_buy: 2.00, currency: "EUR", price: 8.00 },
  );

  //then
  const resultAfter = await storage.getSummary();
  assert(resultAfter !== null, "result should exist");
  assertEquals(resultAfter.transactions.length, 1);
  assertEquals(resultAfter.storage.length, 1);
  assertEquals(resultAfter.pending.length, 0);
});

Deno.test("should not cover pending transaction with new buy transaction", async () => {
  //given
  const transactions = [
    { tx: "t5", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 0);
  assertEquals(result.storage.length, 0);
  assertEquals(result.pending.length, 1);

  //when
  await storage.handleNewBuyTransaction(
    { tx: "t6", we_buy: 1.75, currency: "EUR", price: 8.00 },
  );

  //then
  const resultAfter = await storage.getSummary();
  assert(resultAfter !== null, "result should exist");
  assertEquals(resultAfter.transactions.length, 0);
  assertEquals(resultAfter.storage.length, 1); // we_buy stays in storage
  assertEquals(resultAfter.pending.length, 1);
});

Deno.test("should try to add any pending transaction", async () => {
  //given
  const transactions = [
    { tx: "t5", we_sell: 3.00, currency: "EUR", price: 15.00 },
    { tx: "t6", we_sell: 2.00, currency: "EUR", price: 10.00 },
  ];
  const storage = await getStoreWithTransactions(transactions);

  //when
  const result = await storage.getSummary();

  //then
  assert(result !== null, "result should exist");
  assertEquals(result.transactions.length, 0);
  assertEquals(result.storage.length, 0);
  assertEquals(result.pending.length, 2);

  //when
  await storage.handleNewBuyTransaction(
    { tx: "t7", we_buy: 2, currency: "EUR", price: 8.00 },
  );

  //then
  const resultAfter = await storage.getSummary();
  assert(resultAfter !== null, "result should exist");
  assertEquals(resultAfter.transactions.length, 1);
  assertEquals(resultAfter.transactions[0].tx, "t6");
  assertEquals(resultAfter.transactions[0].result, 2.0);
  assertEquals(resultAfter.storage.length, 1); // we_buy stays in storage
  assertEquals(resultAfter.storage[0].amount, 0); // we_buy stays in storage
  assertEquals(resultAfter.storage[0].equivalent, 0); // we_buy stays in storage
  assertEquals(resultAfter.pending.length, 1);
  assertEquals(resultAfter.pending[0].tx, "t5");
});
