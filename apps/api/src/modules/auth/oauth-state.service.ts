import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthProvider, UserType } from '@influencehub/database';
import { PrismaService } from '../../common/services/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';

/** Server-side OAuth `state` store with optional PKCE verifier. Single-use, 10-minute TTL. */
@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService) {}

  async create(opts: { provider: AuthProvider; purpose: 'LOGIN' | 'LINK'; userId?: string; userType?: UserType; redirectPath?: string; pkce?: boolean }) {
    const state = CryptoService.randomToken(32);
    const verifier = opts.pkce ? CryptoService.randomToken(48) : undefined;
    await this.prisma.oAuthState.create({
      data: {
        stateHash: CryptoService.sha256(state),
        provider: opts.provider,
        purpose: opts.purpose,
        userId: opts.userId,
        userType: opts.userType,
        redirectPath: sanitizeRedirect(opts.redirectPath),
        codeVerifier: verifier ? this.crypto.encrypt(verifier) : null,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return { state, codeVerifier: verifier, codeChallenge: verifier ? CryptoService.pkceChallenge(verifier) : undefined };
  }

  /** Validates and atomically consumes state. Throws on missing/expired/replayed/mismatched state. */
  async consume(state: string | undefined, provider: AuthProvider) {
    if (!state || state.length < 20 || state.length > 200) throw new BadRequestException({ code: 'OAUTH_STATE_INVALID' });
    const hash = CryptoService.sha256(state);
    const row = await this.prisma.oAuthState.findUnique({ where: { stateHash: hash } });
    if (!row || row.provider !== provider || row.consumedAt || row.expiresAt < new Date()) throw new BadRequestException({ code: 'OAUTH_STATE_INVALID' });
    const updated = await this.prisma.oAuthState.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (updated.count !== 1) throw new BadRequestException({ code: 'OAUTH_STATE_INVALID' });
    return { ...row, codeVerifier: row.codeVerifier ? this.crypto.decrypt(row.codeVerifier) : undefined };
  }
}

/** Only allow same-site relative redirects (prevents open redirect). */
export function sanitizeRedirect(path?: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\r\n]/.test(path)) return null;
  return path.slice(0, 300);
}
