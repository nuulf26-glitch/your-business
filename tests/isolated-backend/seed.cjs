const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const argon2 = require('../../backend/node_modules/argon2');

async function main() {
  const prisma = new PrismaClient();
  try {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    const slug = process.env.E2E_STORE_SLUG;
    const secondEmail = process.env.E2E_SECOND_TEST_EMAIL;
    const secondPassword = process.env.E2E_SECOND_TEST_PASSWORD;
    if (!email || !password || !slug || !secondEmail || !secondPassword) throw new Error('Isolated E2E account configuration is incomplete.');
    if (!process.env.DATABASE_URL?.includes('127.0.0.1') && !process.env.DATABASE_URL?.includes('localhost')) {
      throw new Error('Refusing to seed outside the local ephemeral PostgreSQL service.');
    }
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        email,
        fullName: 'Synthetic E2E Owner',
        passwordHash,
        role: 'OWNER',
        emailVerifiedAt: new Date(),
        termsConsents: {
          create: { termsVersion: 'isolated-e2e', privacyVersion: 'isolated-e2e' },
        },
        subscriptions: {
          create: {
            plan: 'BASIC',
            status: 'ACTIVE',
            billingType: 'ONE_TIME',
            trialEndsAt: new Date(),
          },
        },
        businesses: {
          create: {
            name: 'Synthetic E2E Store',
            slug,
            category: 'retail',
            website: { create: { draft: {} } },
          },
        },
      },
    });
    await prisma.user.create({
      data: {
        email: secondEmail,
        fullName: 'Synthetic E2E Merchant B',
        passwordHash: await argon2.hash(secondPassword),
        role: 'OWNER',
        emailVerifiedAt: new Date(),
        termsConsents: {
          create: { termsVersion: 'isolated-e2e', privacyVersion: 'isolated-e2e' },
        },
        subscriptions: {
          create: {
            plan: 'BASIC',
            status: 'ACTIVE',
            billingType: 'ONE_TIME',
            trialEndsAt: new Date(),
          },
        },
        businesses: {
          create: {
            name: 'Synthetic E2E Merchant B Store',
            slug: `${slug}-merchant-b`,
            category: 'retail',
            website: { create: { draft: {} } },
          },
        },
      },
    });
    process.stdout.write('Created two synthetic E2E owners in the ephemeral local database.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
