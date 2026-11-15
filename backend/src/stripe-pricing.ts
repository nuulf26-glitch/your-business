export type StripePrice = {
  amountCents: number;
  temporary: boolean;
};

export function stripePriceForUser(
  email: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): StripePrice {
  const standardAmount = env.STRIPE_BASIC_AMOUNT || "24600";
  const allowlistedEmails = new Set(
    (env.STRIPE_TEMP_TEST_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const normalizedEmail = (email || "").trim().toLowerCase();
  const temporary =
    env.STRIPE_TEMP_TEST_PRICE_ENABLED?.trim().toLowerCase() === "true" &&
    normalizedEmail.length > 0 &&
    allowlistedEmails.has(normalizedEmail);

  return {
    amountCents: temporary ? 100 : Number(standardAmount),
    temporary,
  };
}
