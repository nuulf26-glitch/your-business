import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter?: Transporter;
  configurationStatus() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
    const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'].filter(key => !process.env[key]?.trim());
    const port = Number(SMTP_PORT);
    return {
      configured: missing.length === 0,
      missing,
      gmailHost: SMTP_HOST?.trim().toLowerCase() === 'smtp.gmail.com',
      supportedPort: port === 465 || port === 587,
      smtpUserConfigured: !!SMTP_USER?.trim(),
      passwordConfigured: !!SMTP_PASSWORD?.trim(),
      mailFromConfigured: !!MAIL_FROM?.trim(),
    };
  }
  private getTransporter() {
    if (this.transporter) return this.transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    const missing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'].filter(key => !process.env[key]?.trim());
    if (missing.length) {
      throw new ServiceUnavailableException(`Email delivery is not configured (missing: ${missing.join(', ')})`);
    }
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
    return this.transporter;
  }
  async sendAccountLink(email: string, token: string, type: 'verify' | 'reset') {
    const base = process.env.PUBLIC_APP_URL;
    if (!base) throw new ServiceUnavailableException('PUBLIC_APP_URL is not configured');
    const path = type === 'verify' ? '/verify-email' : '/reset-password';
    const url = `${base.replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`;
    // SMTP providers normally require the authenticated mailbox to be the sender.
    // Allow MAIL_FROM to be omitted while keeping an explicit override available.
    await this.getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER, to: email,
      subject: type === 'verify' ? 'Verify your GETCYB email' : 'Reset your GETCYB password',
      text: `${type === 'verify' ? 'Verify your email' : 'Reset your password'} using this secure link: ${url}\nIf you did not request this, ignore this message.`,
    });
  }

  async verifySmtp() {
    const configuration = this.configurationStatus();
    if (!configuration.configured) return { ...configuration, authenticated: false, failure: 'missing_configuration' as const };
    try {
      await this.getTransporter().verify();
      return { ...configuration, authenticated: true, failure: null };
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      const responseCode = typeof error === 'object' && error && 'responseCode' in error ? Number(error.responseCode) : undefined;
      const failure = code === 'EAUTH' || (responseCode !== undefined && responseCode >= 530 && responseCode <= 539)
        ? 'authentication_failed'
        : ['ECONNECTION', 'ETIMEDOUT', 'ENOTFOUND', 'ESOCKET'].includes(code)
          ? 'connection_failed'
          : 'smtp_verification_failed';
      return { ...configuration, authenticated: false, failure, errorCode: code || undefined, responseCode };
    }
  }
}
