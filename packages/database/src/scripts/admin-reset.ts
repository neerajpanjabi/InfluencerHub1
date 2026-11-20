/**
 * Local recovery for an admin account: clears two-factor enrolment (the admin re-enrols at next
 * sign-in), signs out all sessions and, optionally, sets a new password.
 *
 *   pnpm admin:reset -- admin@influencehub.local
 *   pnpm admin:reset -- admin@influencehub.local "NewStrongPass2026!"
 *
 * Needs direct database access (DATABASE_URL), so it is an operator tool, not an app feature.
 */
try {
  process.loadEnvFile('.env');
} catch {
  /* rely on the environment */
}
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

async function main() {
  const [email, password] = process.argv.slice(2).filter((a) => a !== '--');
  if (!email) throw new Error('Usage: pnpm admin:reset -- <admin email> [new password]');
  if (password && (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) throw new Error('Password must be at least 10 characters with letters and numbers.');
  const db = new PrismaClient();
  try {
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.type !== 'ADMIN') throw new Error(`No admin account found for ${email}`);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null, failedLoginCount: 0, lockedUntil: null, ...(password ? { passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } : {}) },
      }),
      db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.auditLog.create({ data: { actorId: null, action: 'admin.recovery_reset', entityType: 'User', entityId: user.id, after: { twoFactorReset: true, passwordReset: !!password } } }),
    ]);
    console.log(`✔ Reset ${user.email}: two-factor cleared${password ? ', password changed' : ''}, all sessions signed out.`);
    console.log('  Sign in at /en/admin/login and enrol two-factor authentication again.');
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
