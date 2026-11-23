import { BadRequestException, ConflictException, Controller, ForbiddenException, Get, Logger, NotFoundException, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard, tokenHash } from './session';
import { applyDirectChargeEvent, directChargeHeaders, validatedDirectChargeAccount } from './connect-direct-charges';

const ACCOUNT_RECORD = 'stripeConnectAccount';
const PAYMENT_RECORD = 'stripeConnectPayment';
const WEBHOOK_RECORD = 'stripeConnectWebhook';
const idFor = (prefix: string, value: string) => prefix + createHash('sha256').update(value).digest('hex').slice(0, 48);
const safeAccountId = (value: unknown): value is string => typeof value === 'string' && /^acct_[A-Za-z0-9]+$/.test(value);

function directChargesEnabled() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || '';
  return process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED === 'true'
    && /^sk_test_[A-Za-z0-9]+$/.test(key);
}
function enabledCountries() {
  const raw = process.env.STRIPE_CONNECT_APPROVED_COUNTRIES?.trim() || 'AE';
  return raw.split(',').map((country) => country.trim().toUpperCase()).filter((country) => /^[A-Z]{2}$/.test(country));
}

@Controller('connect/stripe')
@UseGuards(SessionGuard)
export class StripeConnectController {
  private readonly logger = new Logger(StripeConnectController.name);
  constructor(private readonly db: DbService) {}

  private async business(req: Request & { user: any }) {
    const id = String(req.get('x-cyb-business-id') || '').trim();
    const business = await this.db.business.findFirst({ where: id ? { id, ownerId: req.user.id } : { ownerId: req.user.id } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private async stripe(path: string, init: RequestInit = {}, connectedAccount?: string, idempotencyKey?: string) {
    if (!directChargesEnabled()) throw new ServiceUnavailableException('Merchant card payments are not enabled. Stripe test-mode approval and configuration are required.');
    const key = process.env.STRIPE_SECRET_KEY!.trim();
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, ...(init.headers as Record<string, string> || {}) };
    if (connectedAccount) {
      if (!safeAccountId(connectedAccount)) throw new BadRequestException('Invalid connected account');
      headers['Stripe-Account'] = connectedAccount;
    }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    let response: globalThis.Response;
    try {
      response = await fetch(`https://api.stripe.com/v1${path}`, { ...init, headers, signal: AbortSignal.timeout(20000) });
    } catch {
      throw new ServiceUnavailableException('Stripe could not be reached. Please try again.');
    }
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) {
      this.logger.warn(JSON.stringify({ status: response.status, code: body.error?.code || 'unknown', type: body.error?.type || 'unknown' }));
      throw new ServiceUnavailableException('Stripe could not complete this request. Check the merchant account and try again.');
    }
    return body;
  }

  @Get('status')
  async status(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const record = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: ACCOUNT_RECORD } });
    const state = record?.data as any || {};
    if (!directChargesEnabled()) return { enabled: false, connected: false, reason: 'Stripe Connect test-mode approval/configuration is pending.' };
    if (!safeAccountId(state.accountId)) return { enabled: true, connected: false, country: 'AE', supportedCountries: enabledCountries() };
    try {
      const account = await this.stripe(`/accounts/${encodeURIComponent(state.accountId)}`);
      const verifiedId = validatedDirectChargeAccount(account);
      const capabilities = account.capabilities || {};
      await this.db.businessRecord.update({ where: { id: record!.id }, data: { data: { accountId: state.accountId, country: account.country || state.country || 'AE', detailsSubmitted: account.details_submitted === true, chargesEnabled: account.charges_enabled === true, payoutsEnabled: account.payouts_enabled === true, cardPayments: capabilities.card_payments || 'inactive', updatedAt: new Date().toISOString() } as any } });
      return { enabled: true, connected: true, accountId: state.accountId, country: account.country || state.country || 'AE', chargesEnabled: account.charges_enabled === true, payoutsEnabled: account.payouts_enabled === true, cardPayments: capabilities.card_payments || 'inactive', directChargesReady: !!verifiedId };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      return { enabled: true, connected: true, country: state.country || 'AE', directChargesReady: false, accountStatus: 'needs_attention' };
    }
  }

  @Post('onboarding')
  async onboarding(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    if (!directChargesEnabled()) throw new ServiceUnavailableException('Stripe Connect test-mode approval/configuration is pending.');
    const country = (process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || 'AE').toUpperCase();
    if (!enabledCountries().includes(country)) throw new ForbiddenException('This merchant country is not approved for Stripe Connect.');
    const app = new URL(process.env.PUBLIC_APP_URL || 'https://getcyb-staging-web.onrender.com');
    if (app.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('Secure Stripe return URLs are required.');
    let record = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: ACCOUNT_RECORD } });
    let accountId = (record?.data as any)?.accountId;
    if (!safeAccountId(accountId)) {
      const form = new URLSearchParams({ type: 'express', country, 'capabilities[card_payments][requested]': 'true', 'capabilities[transfers][requested]': 'true', 'metadata[cybBusinessId]': business.id });
      const account = await this.stripe('/accounts', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
      if (!safeAccountId(account.id)) throw new ServiceUnavailableException('Stripe did not create a connected account.');
      accountId = account.id;
      const data = { accountId, country, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, cardPayments: 'pending', createdAt: new Date().toISOString() };
      record = record
        ? await this.db.businessRecord.update({ where: { id: record.id }, data: { data: data as any } })
        : await this.db.businessRecord.create({ data: { id: idFor('scacct_', business.id), businessId: business.id, type: ACCOUNT_RECORD, status: 'pending', data: data as any } });
    }
    const refresh = new URL('/settings?stripe_connect=refresh', app.origin).toString();
    const ret = new URL('/settings?stripe_connect=return', app.origin).toString();
    const form = new URLSearchParams({ account: accountId, refresh_url: refresh, return_url: ret, type: 'account_onboarding' });
    const link = await this.stripe('/account_links', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    if (typeof link.url !== 'string' || !link.url.startsWith('https://connect.stripe.com/')) throw new ServiceUnavailableException('Stripe did not return a valid onboarding link.');
    return { url: link.url };
  }

  @Get('transactions')
  async transactions(@Req() req: Request & { user: any }) {
    const business = await this.business(req);
    const rows = await this.db.businessRecord.findMany({ where: { businessId: business.id, type: PAYMENT_RECORD }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((row: any) => ({ id: row.id, ...(row.data as object), createdAt: row.createdAt }));
  }

  @Post('orders/:id/checkout')
  async checkout(@Req() req: Request & { user: any }) {
    throw new ForbiddenException('This endpoint is for public checkout; use the public order route.');
  }

  @Post('refunds/:orderId')
  async refund(@Req() req: Request & { user: any }) {
    const business = await this.business(req), orderId = String(req.params['orderId']);
    const order = await this.db.order.findFirst({ where: { id: orderId, businessId: business.id } });
    if (!order) throw new NotFoundException('Order not found');
    const data = order.data as any;
    const payment = await this.db.businessRecord.findFirst({ where: { businessId: business.id, type: PAYMENT_RECORD, data: { path: ['orderId'], equals: order.id } } });
    if (!payment || !safeAccountId((payment.data as any)?.accountId) || !(payment.data as any)?.paymentIntentId || String(data.paymentStatus).toLowerCase() !== 'paid') throw new ConflictException('Only a collected Stripe merchant payment can be refunded.');
    const accountId = (payment.data as any).accountId, intentId = (payment.data as any).paymentIntentId;
    const form = new URLSearchParams({ payment_intent: intentId });
    const result = await this.stripe('/refunds', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }, accountId, `cyb-refund-${order.id}`);
    await this.db.businessRecord.update({ where: { id: payment.id }, data: { data: { ...(payment.data as any), refundId: result.id, refundStatus: result.status || 'pending' } as any } });
    return { submitted: true, status: result.status || 'pending' };
  }
}

@Controller('payments/stripe/connect/webhook')
export class StripeConnectWebhookController {
  private readonly logger = new Logger(StripeConnectWebhookController.name);
  constructor(private readonly db: DbService) {}

  @Post()
  async receive(@Req() req: Request) {
    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
    const signature = req.headers['stripe-signature'];
    if (!secret) throw new ServiceUnavailableException('Stripe Connect webhook is not configured.');
    if (!Buffer.isBuffer(req.body) || typeof signature !== 'string') throw new BadRequestException('Invalid Stripe signature.');
    const parts = signature.split(',').map((part) => part.trim().split('='));
    const timestamps = parts.filter(([key]) => key === 't').map(([, value]) => value);
    if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0]) || Math.abs(Date.now() / 1000 - Number(timestamps[0])) > 300) throw new BadRequestException('Invalid Stripe signature.');
    const expected = createHmac('sha256', secret).update(timestamps[0] + '.').update(req.body).digest();
    const valid = parts.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/i.test(value || '') && timingSafeEqual(expected, Buffer.from(value, 'hex')));
    if (!valid) throw new BadRequestException('Invalid Stripe signature.');
    let event: any;
    try { event = JSON.parse(req.body.toString('utf8')); } catch { throw new BadRequestException('Invalid Stripe event.'); }
    const testKey = /^sk_test_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY?.trim() || '');
    if (!directChargesEnabled() || event.livemode !== false || !testKey) throw new ServiceUnavailableException('Only approved Stripe test-mode events are accepted.');
    if (!event?.id || typeof event.id !== 'string') throw new BadRequestException('Invalid Stripe event.');
    const accountId = event.account;
    if (!safeAccountId(accountId)) return { received: true };
    const account = await this.db.businessRecord.findFirst({ where: { type: ACCOUNT_RECORD, data: { path: ['accountId'], equals: accountId } } });
    if (!account) return { received: true };
    const session = event.data?.object || {};
    const eventId = idFor('scevt_', event.id);
    return this.db.$transaction(async (tx: any) => {
      const inserted = await tx.businessRecord.createMany({ data: [{ id: eventId, businessId: account.businessId, type: WEBHOOK_RECORD, data: { eventId: event.id, eventType: event.type, receivedAt: new Date().toISOString() } }], skipDuplicates: true });
      if (!inserted.count) return { received: true, duplicate: true };
      const supported = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'payment_intent.payment_failed', 'charge.refunded'];
      if (!supported.includes(event.type)) return { received: true };
      const metadata = session.metadata || {};
      const orderId = String(metadata.orderId || '');
      const paymentIntentId = String(session.payment_intent || (session.object === 'payment_intent' ? session.id : '') || '');
      let payment = orderId ? await tx.businessRecord.findFirst({ where: { businessId: account.businessId, type: PAYMENT_RECORD, data: { path: ['orderId'], equals: orderId } } }) : null;
      if (!payment && paymentIntentId) payment = await tx.businessRecord.findFirst({ where: { businessId: account.businessId, type: PAYMENT_RECORD, data: { path: ['paymentIntentId'], equals: paymentIntentId } } });
      if (!payment) return { received: true };
      const paymentData = payment.data as any;
      const order = await tx.order.findFirst({ where: { id: paymentData.orderId, businessId: account.businessId } });
      if (!order) return { received: true };
      const orderData = order.data as any;
      const now = new Date().toISOString();
      const { status, nextOrder } = applyDirectChargeEvent(event, orderData, Number(order.amountCents || 0));
      const updated = await tx.order.updateMany({ where: { id: order.id, businessId: account.businessId, data: { equals: order.data } }, data: { data: nextOrder } });
      if (!updated.count) throw new ConflictException('Order changed while a Stripe event was being applied.');
      await tx.businessRecord.update({ where: { id: payment.id }, data: { data: { ...paymentData, status, paymentIntentId: paymentIntentId || paymentData.paymentIntentId, updatedAt: now } } });
      const email = String(orderData.email || '').trim().toLowerCase();
      if (email) {
        const customer = await tx.customer.findFirst({ where: { businessId: account.businessId, data: { path: ['email'], equals: email } } });
        if (customer) {
          const orders = await tx.order.findMany({ where: { businessId: account.businessId } });
          const matching = orders.filter((row: any) => String((row.data as any)?.email || '').trim().toLowerCase() === email);
          const paid = matching.filter((row: any) => String((row.data as any)?.paymentStatus || '').toLowerCase() === 'paid');
          const collected = paid.reduce((sum: number, row: any) => sum + (Number((row.data as any)?.collectedAmountCents ?? row.amountCents ?? 0) || 0), 0);
          const refunded = matching.reduce((sum: number, row: any) => sum + (Array.isArray((row.data as any)?.refundHistory) ? (row.data as any).refundHistory.reduce((part: number, entry: any) => part + (Number(entry.amountCents) || 0), 0) : 0), 0);
          await tx.customer.update({ where: { id: customer.id }, data: { data: { ...(customer.data as any), totalSpent: Math.max(0, collected - refunded) / 100, paidOrders: paid.length, orders: matching.length } } });
        }
      }
      return { received: true };
    });
  }
}
