import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';

/** AES-256-GCM envelope for secrets at rest (OAuth tokens, TOTP secrets, PKCE verifiers). */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  constructor() {
    this.key = Buffer.from(env().ENCRYPTION_KEY, 'base64');
    if (this.key.length !== 32) throw new Error('ENCRYPTION_KEY must be base64 of 32 bytes');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
  }

  decrypt(payload: string): string {
    const [v, iv, tag, data] = payload.split('.');
    if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  }

  static sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  static randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  static hmacHex(secret: string, payload: string | Buffer): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  static safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  /** PKCE S256 code challenge for a verifier. */
  static pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
