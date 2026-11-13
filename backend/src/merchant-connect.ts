import { Controller, Get, Post, Req, Res, UseGuards, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';

const STAGING = 'https://getcyb-staging-web.onrender.com';

// Onboarding only. This controller never creates payments, transfers or accounts.
// A UAE settlement configuration must be confirmed by Stripe before provisioning.
@Controller('merchant-payments/stripe-connect')
@UseGuards(SessionGuard)
export class MerchantConnectController {
  constructor(private readonly db: DbService) {}

  private configuration() {
    const key = process.env.STRIPE_CONNECT_TEST_SECRET_KEY?.trim() || '';
    const platform = process.env.STRIPE_CONNECT_TEST_PLATFORM_ACCOUNT?.trim() || '';
    if (process.env.STRIPE_CONNECT_TEST_ONBOARDING_ENABLED !== 'true' ||
        process.env.STRIPE_CONNECT_UAE_CONFIGURATION_CONFIRMED !== 'true' ||
        process.env.PUBLIC_APP_URL !== STAGING ||
        !/^sk_test_[A-Za-z0-9]+$/.test(key) || !/^acct_[A-Za-z0-9]+$/.test(platform)) {
      throw new ServiceUnavailableException('Merchant test onboarding is not configured or approved.');
    }
    return { key, platform };
  }

  private async stripe(path: string, method = 'GET', form?: URLSearchParams) {
    const { key } = this.configuration();
    try {
      const response = await fetch(`https://api.stripe.com/v1${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: form?.toString(), signal: AbortSignal.timeout(15000),
      });
      const value = await response.json() as any;
      if (!response.ok) throw new Error('Provider request failed');
      return value;
    } catch {
      // Do not expose provider responses, credentials, account details or onboarding links in errors.
      throw new ServiceUnavailableException('Merchant payment provider is unavailable.');
    }
  }

  private async merchant(userId: string) {
    const business = await this.db.business.findFirst({ where: { ownerId: userId } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private accountId(businessId: string): string | null {
    // Operator-managed test bindings. There is deliberately no client-facing bind endpoint.
    // Never accept an account ID, merchant ID or return URL from a request body.
    let bindings: unknown;
    try { bindings = JSON.parse(process.env.STRIPE_CONNECT_TEST_ACCOUNT_BINDINGS || '{}'); }
    catch { throw new ServiceUnavailableException('Merchant test bindings are invalid.'); }
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
      throw new ServiceUnavailableException('Merchant test bindings are invalid.');
    }
    const entries = Object.entries(bindings);
    if (entries.some(([, id]) => typeof id !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(id)) ||
        new Set(entries.map(([, id]) => id)).size !== entries.length) {
      throw new ServiceUnavailableException('Merchant test bindings are invalid.');
    }
    return Object.prototype.hasOwnProperty.call(bindings, businessId)
      ? (bindings as Record<string, string>)[businessId] : null;
  }

  private async verifiedAccount(businessId: string, accountId: string) {
    const { platform } = this.configuration();
    const balance = await this.stripe('/balance');
    if (balance.object !== 'balance' || balance.livemode !== false) {
      throw new ServiceUnavailableException('A verified Stripe test environment is required.');
    }
    const identity = await this.stripe('/account');
    if (identity.id !== platform || accountId === platform) {
      throw new ServiceUnavailableException('Stripe platform identity does not match.');
    }
    const account = await this.stripe(`/accounts/${encodeURIComponent(accountId)}`);
    if (account.id !== accountId || account.object !== 'account' || account.country !== 'AE' ||
        account.type !== 'custom' || account.metadata?.cybBusinessId !== businessId) {
      throw new ServiceUnavailableException('Merchant account ownership or UAE configuration does not match.');
    }
    return account;
  }

  @Get('status')
  async status(@Req() req: Request & { user: { id: string } }, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const business = await this.merchant(req.user.id);
    const closed = { provider: 'stripe-connect', mode: 'test', checkoutEnabled: false, cardEnabled: false, walletsEnabled: false };
    try { this.configuration(); }
    catch { return { ...closed, connectionStatus: 'disabled' }; }
    const id = this.accountId(business.id);
    if (!id) return { ...closed, connectionStatus: 'not_connected' };
    const account = await this.verifiedAccount(business.id, id);
    const ready = account.charges_enabled === true && account.payouts_enabled === true &&
      account.capabilities?.transfers === 'active' && !account.requirements?.disabled_reason &&
      Array.isArray(account.requirements?.currently_due) && account.requirements.currently_due.length === 0 &&
      Array.isArray(account.requirements?.past_due) && account.requirements.past_due.length === 0;
    return { ...closed, connectionStatus: ready ? 'verified_test_connection' : 'requirements_due' };
  }

  @Post('onboarding-link')
  async onboarding(@Req() req: Request & { user: { id: string } }, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    this.configuration();
    const business = await this.merchant(req.user.id);
    const id = this.accountId(business.id);
    if (!id) throw new NotFoundException('No approved merchant test account is connected.');
    await this.verifiedAccount(business.id, id);
    const result = await this.stripe('/account_links', 'POST', new URLSearchParams({
      account: id, type: 'account_onboarding',
      return_url: `${STAGING}/settings?merchant_connect=return`,
      refresh_url: `${STAGING}/settings?merchant_connect=refresh`,
    }));
    let url: URL;
    try { url = new URL(result.url); }
    catch { throw new ServiceUnavailableException('Invalid merchant onboarding response.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com' || url.username || url.password) {
      throw new ServiceUnavailableException('Invalid merchant onboarding response.');
    }
    return { url: result.url };
  }
}
