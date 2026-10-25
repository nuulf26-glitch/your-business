import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DbService } from './database';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: DbService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.getcyb_session;
    if (!token) throw new UnauthorizedException('Sign in required');
    const session = await this.db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');
    req.user = session.user;
    return true;
  }
}
