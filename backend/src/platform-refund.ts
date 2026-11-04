import { BadRequestException, Controller, NotFoundException, Post, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DbService } from './database';
import { SessionGuard } from './session';

@Controller('payments')
@UseGuards(SessionGuard)
export class PlatformRefundController {
  constructor(private db: DbService) {}

  @Post('platform-access/refund')
  async refund(@Req() req: Request & { user: any }) {
    const payments = await this.db.paymentReference.findMany({
      where: { userId: req.user.id, provider: { in: ['stripe', 'paypal'] }, status: { in: ['COMPLETED', 'REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const payment = payments.find(item => (item.metadata as any)?.intent === 'PLATFORM_ACCESS');
    if (!payment) throw new NotFoundException('No completed platform payment was found');
    if (payment.status === 'REFUNDED') return { success: true, status: 'REFUNDED' };
    const paymentDate = new Date(payment.createdAt);
    if (!Number.isFinite(paymentDate.getTime()) || Date.now() - paymentDate.getTime() > 30 * 864e5) {
      throw new BadRequestException('The 30-day refund period has ended');
    }
    let refundId: string | undefined;
    if (payment.provider === 'stripe') {
      const key = process.env.STRIPE_SECRET_KEY;
      const paymentIntentId = (payment.metadata as any)?.paymentIntentId;
      if (!key || typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
        throw new ServiceUnavailableException('This Stripe payment cannot be refunded automatically. Please contact support.');
      }
      const form = new URLSearchParams({ payment_intent: paymentIntentId });
      let response: globalThis.Response;
      try {
        response = await fetch('https://api.stripe.com/v1/refunds', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `getcyb-refund-${payment.id}` },
          body: form.toString(),
          signal: AbortSignal.timeout(20000),
        });
      } catch {
        throw new ServiceUnavailableException('The refund provider could not be reached. Please try again.');
      }
      const result = await response.json().catch(() => ({})) as any;
      if (!response.ok || !result.id) throw new BadRequestException('Stripe could not process the refund. Please try again.');
      refundId = result.id;
    } else {
      const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET;
      const captureId = payment.providerCaptureId;
      if (!id || !secret || !captureId) throw new ServiceUnavailableException('This PayPal payment cannot be refunded automatically. Please contact support.');
      const base = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(20000),
      });
      const tokenData = await tokenResponse.json().catch(() => ({})) as any;
      if (!tokenResponse.ok || !tokenData.access_token) throw new ServiceUnavailableException('PayPal could not authorize the refund. Please try again.');
      const response = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `getcyb-refund-${payment.id}` },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({})) as any;
      if (!response.ok || !result.id) throw new BadRequestException('PayPal could not process the refund. Please try again.');
      refundId = result.id;
    }
    await this.db.$transaction([
      this.db.paymentReference.update({ where: { id: payment.id }, data: { status: 'REFUNDED', metadata: { ...(payment.metadata as any), refundId, refundedAt: new Date().toISOString() } } }),
      this.db.subscription.updateMany({ where: { userId: req.user.id }, data: { status: 'INACTIVE', billingType: 'ONE_TIME' } }),
    ]);
    return { success: true, status: 'REFUNDED' };
  }
}
