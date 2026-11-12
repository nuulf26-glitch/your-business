import { OrderController } from "../src/routes";

describe("storefront order payment status", () => {
  it("records collection when the merchant marks a COD order paid", async () => {
    const row: any = {
      id: "order_1",
      businessId: "biz_1",
      status: "new",
      createdAt: new Date("2026-11-13T00:00:00.000Z"),
      data: {
        paymentMethod: "cash",
        paymentStatus: "Unpaid",
        customerActionTokenHash: "private-hash",
      },
    };
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: "biz_1" }) },
      order: {
        findFirst: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }: any) => ({ ...row, ...data })),
      },
    };
    const controller = new OrderController(db);

    const result = await controller.updateStatus(
      { user: { id: "owner_1" }, params: { id: "order_1" } } as any,
      { status: "paid" } as any,
    );

    const saved = db.order.update.mock.calls[0][0];
    expect(saved.where).toEqual({ id: "order_1" });
    expect(saved.data.status).toBe("paid");
    expect(saved.data.data).toMatchObject({
      paymentMethod: "cash",
      paymentStatus: "Paid",
    });
    expect(saved.data.data.paymentCollectedAt).toEqual(expect.any(String));
    expect(result.paymentStatus).toBe("Paid");
    expect(result).not.toHaveProperty("customerActionTokenHash");
  });

  it("keeps a COD order unpaid when its fulfilment status changes", async () => {
    const row: any = {
      id: "order_2",
      businessId: "biz_1",
      status: "new",
      createdAt: new Date("2026-11-13T00:00:00.000Z"),
      data: { paymentMethod: "cash", paymentStatus: "Unpaid" },
    };
    const db: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: "biz_1" }) },
      order: {
        findFirst: jest.fn().mockResolvedValue(row),
        update: jest.fn(async ({ data }: any) => ({ ...row, ...data })),
      },
    };

    await new OrderController(db).updateStatus(
      { user: { id: "owner_1" }, params: { id: "order_2" } } as any,
      { status: "processing" } as any,
    );

    expect(db.order.update.mock.calls[0][0].data.data.paymentStatus).toBe("Unpaid");
  });
});
