import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseBridge {
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      const { cert, getApps, initializeApp } = require('firebase-admin/app');
      const { getAuth } = require('firebase-admin/auth');
      let app=getApps()[0];
      if(!app){
        const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        app=raw?initializeApp({credential:cert(JSON.parse(raw))}):initializeApp({projectId:process.env.FIREBASE_PROJECT_ID||'your-business-47e44'});
      }
      return await getAuth(app).verifyIdToken(idToken,true);
    }catch{throw new UnauthorizedException('Firebase sign-in token is invalid or expired');}
  }
}
