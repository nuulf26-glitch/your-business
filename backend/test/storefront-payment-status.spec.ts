import { OrderController } from "../src/routes";

function harness(initial: any = {
  id: "order_1",
  businessId: "biz_1",
  status: "new",
  amountCents: 3500,
  currency: "USD",
  createdAt: new Date("2026-11-13T00:00:00.000Z"),
  data: { email: "buyer@example.com", paymentMethod: "cash", paymentStatus: "Unpaid" },
}) {
  let row = structuredClone(initial);
  const customer = { id: "customer_1", businessId: "biz_1", data: { email: "buyer@example.com", totalSpent: 999 } };
  const tx: any = {
    order: {
      findFirst: jest.fn(async ({ where }: any) => where.id === row.id && where.businessId === row.businessId ? structuredClone(row) : null),
      findMany: jest.fn(async ({ where }: any) => where.businessId === row.businessId ? [structuredClone(row)] : []),
      update: jest.fn(async ({ data }: any) => { row = { ...row, ...data }; return structuredClone(row); }),
    },
    customer: {
      findFirst: jest.fn(async ({ where }: any) => where.businessId === customer.businessId ? structuredClone(customer) : null),
      update: jest.fn(async ({ data }: any) => { customer.data = data.data; return structuredClone(customer); }),
    },
  };
  const db: any = {
    business: { findFirst: jest.fn(async ({ where }: any) => where.ownerId === "owner_1" ? { id: "biz_1" } : null) },
    $transaction: jest.fn(async (callback: any, options: any) => {
      expect(options).toEqual({ isolationLevel: expect.anything() });
      return callback(tx);
    }),
    order: { findFirst: jest.fn(async ({ where }: any) => where.id === row.id && where.businessId === row.businessId ? row : null) },
  };
  return { controller: new OrderController(db), db, tx, customer, current: () => structuredClone(row) };
}

const ownerReq = (id = "order_1") => ({ user: { id: "owner_1" }, params: { id } } as any);
const status = (value: string) => ({ status: value } as any);

describe("storefront payment accounting", () => {
  it("keeps a new COD order unpaid and customer spend at zero", async () => {
    const h = harness();
    const result: any = await h.controller.updateStatus(ownerReq(), status("processing"));
    expect(result.paymentStatus).toBe("Unpaid");
    expect(result.paymentHistory).toEqual([]);
    expect(h.customer.data.totalSpent).toBe(0);
  });

  it("records a collection once when an authorized merchant marks paid", async () => {
    const h = harness();
    const first: any = await h.controller.updateStatus(ownerReq(), status("paid"));
    const second: any = await h.controller.updateStatus(ownerReq(), status("paid"));

    expect(first.paymentStatus).toBe("Paid");
    expect(second.paymentHistory).toHaveLength(1);
    expect(second.paymentHistory[0]).toMatchObject({ type: "collected", amountCents: 3500 });
    expect(h.customer.data.totalSpent).toBe(35);
    expect(h.tx.customer.update).toHaveBeenCalledTimes(2);
    expect(h.db.business.findFirst).toHaveBeenCalledWith({ where: { ownerId: "owner_1" } });
    expect(h.tx.order.findFirst).toHaveBeenCalledWith({ where: { id: "order_1", businessId: "biz_1" } });
  });

  it("keeps unpaid cancellations out of collected totals", async () => {
    const h = harness();
    const result = await h.controller.updateStatus(ownerReq(), status("cancelled"));
    expect(result.status).toBe("cancelled");
    expect(result.paymentStatus).toBe("Unpaid");
    expect(h.customer.data.totalSpent).toBe(0);
    expect(result.paymentHistory).toEqual([]);
  });

  it("retains the collection event and reverses spend once on refund", async () => {
    const h = harness();
    await h.controller.updateStatus(ownerReq(), status("paid"));
    const firstRefund: any = await h.controller.updateStatus(ownerReq(), status("refunded"));
    const repeatedRefund: any = await h.controller.updateStatus(ownerReq(), status("refunded"));

    expect(firstRefund.paymentStatus).toBe("Refunded");
    expect(repeatedRefund.paymentHistory.map((event: any) => event.type)).toEqual(["collected", "refunded"]);
    expect(h.customer.data.totalSpent).toBe(0);
  });

  it("records reversals without deleting payment history", async () => {
    const h = harness();
    await h.controller.updateStatus(ownerReq(), status("paid"));
    const reversed: any = await h.controller.updateStatus(ownerReq(), status("reversed"));
    expect(reversed.paymentStatus).toBe("Reversed");
    expect(reversed.paymentHistory.map((event: any) => event.type)).toEqual(["collected", "reversed"]);
    expect(h.customer.data.totalSpent).toBe(0);
  });

  it("does not expose another business's order to this merchant", async () => {
    const h = harness({
      id: "order_other", businessId: "biz_other", status: "new", amountCents: 3500,
      currency: "USD", createdAt: new Date(), data: { email: "buyer@example.com", paymentStatus: "Unpaid" },
    });
    await expect(h.controller.updateStatus(ownerReq("order_other"), status("paid"))).rejects.toThrow("Order not found");
    expect(h.tx.order.findFirst).toHaveBeenCalledWith({ where: { id: "order_other", businessId: "biz_1" } });
    expect(h.tx.order.update).not.toHaveBeenCalled();
  });
});
