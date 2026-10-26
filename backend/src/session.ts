import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DbService } from './database';

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: DbService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const bearer = process.env.AUTH_BEARER_ENABLED === 'true'
      ? String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]
      : undefined;
    const token = req.cookies?.getcyb_session || bearer;
    if (!token) throw new UnauthorizedException('Sign in required');
    const session = await this.db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');
    req.user = session.user;
    req.sessionToken = token;
    return true;
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context:ExecutionContext){
    const req=context.switchToHttp().getRequest();
    if(['GET','HEAD','OPTIONS'].includes(req.method))return true;
    const origin=req.headers.origin as string|undefined;
    const allowed=(process.env.FRONTEND_ORIGIN||'http://localhost:5173').split(',').map((x:string)=>{try{return new URL(x.trim()).origin;}catch{return '';}}).filter(Boolean);
    if(origin&&!allowed.includes(origin))throw new ForbiddenException('Request origin is not allowed');
    if(process.env.NODE_ENV==='production'&&req.cookies?.getcyb_session&&!origin)throw new ForbiddenException('Origin header required');
    return true;
  }
}
