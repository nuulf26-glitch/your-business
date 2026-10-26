import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private transporter?: Transporter;
  private getTransporter() {
    if (this.transporter) return this.transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !process.env.MAIL_FROM) {
      throw new ServiceUnavailableException('Email delivery is not configured');
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
}
