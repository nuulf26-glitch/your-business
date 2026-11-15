import { stripePriceForUser } from "../src/stripe-pricing";

describe("temporary Stripe pricing", () => {
  const env = {
    STRIPE_BASIC_AMOUNT: "24600",
    STRIPE_TEMP_TEST_PRICE_ENABLED: "true",
    STRIPE_TEMP_TEST_EMAILS: "tester@example.com, second@example.com",
  } as NodeJS.ProcessEnv;

  it("offers one dollar only to an allowlisted account while enabled", () => {
    expect(stripePriceForUser("Tester@Example.com", env)).toEqual({
      amountCents: 100,
      temporary: true,
    });
  });

  it("keeps the standard price for non-allowlisted accounts", () => {
    expect(stripePriceForUser("public@example.com", env)).toEqual({
      amountCents: 24600,
      temporary: false,
    });
    expect(stripePriceForUser(undefined, env)).toEqual({
      amountCents: 24600,
      temporary: false,
    });
  });

  it("restores the standard price when the temporary flag is disabled", () => {
    expect(
      stripePriceForUser("tester@example.com", {
        ...env,
        STRIPE_TEMP_TEST_PRICE_ENABLED: "false",
      }),
    ).toEqual({ amountCents: 24600, temporary: false });
  });

  it("fails closed when the allowlist is empty", () => {
    expect(
      stripePriceForUser("tester@example.com", {
        ...env,
        STRIPE_TEMP_TEST_EMAILS: "",
      }),
    ).toEqual({ amountCents: 24600, temporary: false });
  });
});
