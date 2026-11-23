import { BadRequestException, Controller, Get, NotFoundException, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createHash } from 'node:crypto';
import { DbService } from './database';
import { tokenHash } from './session';
import { approvedDirectChargeAccount, directChargeHeaders } from './connect-direct-charges';

const accountType = 'stripeConnectAccount';
const paymentType = 'stripeConnectPayment';
const approvedCountries = () => (process.env.STRIPE_CONNECT_APPROVED_COUNTRIES?.trim() || 'AE').split(',').map((value) => value.trim().toUpperCase()).filter((value) => /^[A-Z]{2}$/.test(value));
const validAccount = (value: unknown): value is string => typeof value === 'string' && /^acct_[A-Za-z0-9]+$/.test(value);
const paymentRecordId = (orderId: string) => 'scpay_' + createHash('sha256').update(orderId).digest('hex').slice(0, 48);
function testConnectEnabled() {
  return process.env.STRIPE_CONNECT_DIRECT_CHARGES_TEST_ENABLED === 'true'
    && /^sk_test_[A-Za-z0-9]+$/.test(process.env.STRIPE_SECRET_KEY?.trim() || '');
}

@Controller('public/orders')
export class PublicStripeConnectController {
  constructor(private readonly db: DbService) {}

  private async orderAndAccount(req: Request) {
    const id = String(req.params['id'] || ''), token = String((req.body as any)?.token || req.query.token || '');
    if (!id || !token) throw new NotFoundException('Order not found');
    const order = await this.db.order.findUnique({ where: { id } });
    const storedHash = (order?.data as any)?.customerActionTokenHash;
    if (!order || typeof storedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(storedHash) || !timingSafeEqual(Buffer.from(tokenHash(token), 'hex'), Buffer.from(storedHash, 'hex'))) throw new NotFoundException('Order not found');
    const data = order.data as any;
    if (order.status !== 'new' || ['paid', 'refunded', 'cash on delivery'].includes(String(data.paymentStatus || '').toLowerCase())) throw new BadRequestException('This order is not available for card checkout.');
    const accountRecord = await this.db.businessRecord.findFirst({ where: { businessId: order.businessId, type: accountType } });
    const accountId = (accountRecord?.data as any)?.accountId;
    if (!testConnectEnabled() || !validAccount(accountId)) return { order, data, accountId: null, ready: false };
    let response: globalThis.Response;
    try {
      response = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!.trim()}` }, signal: AbortSignal.timeout(20000) });
    } catch { throw new ServiceUnavailableException('The merchant payment status could not be verified.'); }
    const account = await response.json().catch(() => ({})) as any;
    if (!response.ok) return { order, data, accountId, ready: false };
    const verified = approvedDirectChargeAccount(account, approvedCountries());
    return { order, data, accountId: verified, ready: !!verified };
  }

  @Get(':id/stripe-status')
  async status(@Req() req: Request) {
    const result = await this.orderAndAccount(req);
    return { available: result.ready, method: result.ready ? 'card' : 'cash_on_delivery' };
  }

  @Post(':id/stripe-checkout')
  async checkout(@Req() req: Request) {
    const result = await this.orderAndAccount(req);
    if (!result.ready || !result.accountId) throw new ServiceUnavailableException('Card payments are unavailable for this merchant. Choose cash on delivery.');
    const { order, data, accountId } = result;
    const amount = Number(order.amountCents);
    const currency = String(order.currency || data.currency || '').toLowerCase();
    if (!Number.isSafeInteger(amount) || amount < 50 || !/^[a-z]{3}$/.test(currency)) throw new BadRequestException('The order amount or currency is invalid.');
    const paymentRecordKey = paymentRecordId(order.id);
    const existing = await this.db.businessRecord.findFirst({ where: { id: paymentRecordKey, businessId: order.businessId, type: paymentType } });
    if ((existing?.data as any)?.status === 'paid') throw new BadRequestException('This order has already been paid.');
    if (existing && (existing.data as any)?.status === 'pending' && (existing.data as any)?.checkoutSessionId) {
      const prior = await this.stripeGet(`/checkout/sessions/${encodeURIComponent((existing.data as any).checkoutSessionId)}`, accountId);
      if (prior.status === 'open' && prior.url) return { url: prior.url };
    }
    let appOrigin: string;
    try { appOrigin = new URL(process.env.PUBLIC_APP_URL || 'https://getcyb-staging-web.onrender.com').origin; }
    catch { throw new ServiceUnavailableException('Checkout return URL is not configured.'); }
    const form = new URLSearchParams({
      mode: 'payment',
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][product_data][name]': `Order ${order.id}`,
      'line_items[0][quantity]': '1',
      'success_url': `${appOrigin}/order-success?order_id=${encodeURIComponent(order.id)}&stripe_result=processing`,
      'cancel_url': `${appOrigin}/payment?stripe_cancelled=1`,
      'client_reference_id': order.id,
      'metadata[orderId]': order.id,
      'metadata[businessId]': order.businessId,
      'payment_intent_data[metadata][orderId]': order.id,
      'payment_intent_data[metadata][businessId]': order.businessId,
    });
    const attempt = Number((existing?.data as any)?.attempt || 0) + 1;
    const idempotencyKey = `cyb-direct-${order.id}-${attempt}`.slice(0, 255);
    const pendingData = { orderId: order.id, accountId, amountCents: amount, currency: currency.toUpperCase(), status: 'creating', attempt, updatedAt: new Date().toISOString() };
    await this.db.businessRecord.upsert({
      where: { id: paymentRecordKey },
      create: { id: paymentRecordKey, businessId: order.businessId, type: paymentType, status: 'creating', data: pendingData as any },
      update: { status: 'creating', data: pendingData as any },
    });
    const session = await this.stripePost('/checkout/sessions', form, accountId, idempotencyKey);
    if (!session.id || !session.url) throw new ServiceUnavailableException('Stripe did not return a checkout link.');
    const recordData = { ...pendingData, checkoutSessionId: session.id, paymentIntentId: session.payment_intent || null, status: 'pending', updatedAt: new Date().toISOString() };
    await this.db.businessRecord.update({ where: { id: paymentRecordKey }, data: { data: recordData as any, status: 'pending' } });
    return { url: session.url };
  }

  @Post(':id/stripe-cancel')
  async cancelCheckout(@Req() req: Request) {
    const result = await this.orderAndAccount(req);
    const recordId = paymentRecordId(result.order.id);
    const payment = await this.db.businessRecord.findFirst({ where: { id: recordId, businessId: result.order.businessId, type: paymentType } });
    if (!payment) return { cancelled: true };
    const data = payment.data as any;
    if (['creating', 'pending'].includes(String(data.status || '')) && !result.accountId) throw new ServiceUnavailableException('The active card checkout cannot be closed right now. COD is still blocked to prevent duplicate payment.');
    if (data.status === 'paid') throw new BadRequestException('This order has already been paid.');
    if (data.checkoutSessionId && data.status === 'pending') {
      const session = await this.stripeGet(`/checkout/sessions/${encodeURIComponent(data.checkoutSessionId)}`, result.accountId);
      if (session.status === 'complete') throw new BadRequestException('Payment is already complete.');
      if (session.status === 'open') await this.stripePost(`/checkout/sessions/${encodeURIComponent(data.checkoutSessionId)}/expire`, new URLSearchParams(), result.accountId, `cyb-expire-${result.order.id}`);
    }
    await this.db.businessRecord.update({ where: { id: payment.id }, data: { status: 'expired', data: { ...data, status: 'expired', updatedAt: new Date().toISOString() } } });
    return { cancelled: true };
  }

  private async stripeGet(path: string, accountId: string) {
    let response: globalThis.Response;
    try { response = await fetch(`https://api.stripe.com/v1${path}`, { headers: directChargeHeaders(process.env.STRIPE_SECRET_KEY!.trim(), accountId), signal: AbortSignal.timeout(20000) }); }
    catch { throw new ServiceUnavailableException('Stripe could not be reached.'); }
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new ServiceUnavailableException('Stripe could not verify the previous checkout session.');
    return body;
  }

  private async stripePost(path: string, form: URLSearchParams, accountId: string, idempotencyKey: string) {
    let response: globalThis.Response;
    try { response = await fetch(`https://api.stripe.com/v1${path}`, { method: 'POST', headers: { ...directChargeHeaders(process.env.STRIPE_SECRET_KEY!.trim(), accountId), 'Idempotency-Key': idempotencyKey }, body: form.toString(), signal: AbortSignal.timeout(20000) }); }
    catch { throw new ServiceUnavailableException('Stripe could not be reached.'); }
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new ServiceUnavailableException('Stripe could not create this checkout session.');
    return body;
  }
}
