import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { PrismaService } from '../../common/services/prisma.service';

/** Allowed types are verified by magic bytes, not by client-declared MIME or extension. */
const SIGNATURES: Array<{ mime: string; ext: string; check: (b: Buffer) => boolean }> = [
  { mime: 'image/jpeg', ext: 'jpg', check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', check: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', check: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'video/mp4', ext: 'mp4', check: (b) => b.subarray(4, 8).toString() === 'ftyp' },
];

const PURPOSES = { AVATAR: ['image/'], LOGO: ['image/'], MESSAGE: ['image/', 'application/pdf', 'video/'], DELIVERABLE: ['image/', 'video/', 'application/pdf'], VERIFICATION: ['image/', 'application/pdf'] } as const;
export type UploadPurpose = keyof typeof PURPOSES;

@Injectable()
export class UploadsService {
  private s3 = env().STORAGE_DRIVER === 's3' ? new S3Client({ region: env().S3_REGION, endpoint: env().S3_ENDPOINT, forcePathStyle: !!env().S3_ENDPOINT }) : null;
  constructor(private readonly prisma: PrismaService) {}

  detect(buf: Buffer) {
    return SIGNATURES.find((s) => buf.length >= 12 && s.check(buf));
  }

  async store(ownerId: string, file: { buffer: Buffer; originalname: string; size: number }, purpose: UploadPurpose) {
    if (!file?.buffer?.length) throw new BadRequestException({ code: 'FILE_REQUIRED' });
    if (file.size > env().MAX_UPLOAD_MB * 1024 * 1024) throw new PayloadTooLargeException({ code: 'FILE_TOO_LARGE' });
    const sig = this.detect(file.buffer);
    if (!sig) throw new BadRequestException({ code: 'FILE_TYPE_NOT_ALLOWED' });
    if (!PURPOSES[purpose].some((p) => sig.mime.startsWith(p))) throw new BadRequestException({ code: 'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE' });
    // Reject polyglots: PDFs with embedded JavaScript / launch actions.
    if (sig.mime === 'application/pdf' && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(file.buffer.toString('latin1'))) throw new BadRequestException({ code: 'FILE_REJECTED_ACTIVE_CONTENT' });
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const key = `${purpose.toLowerCase()}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${sig.ext}`;
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: file.buffer, ContentType: sig.mime, ServerSideEncryption: 'AES256' }));
    } else {
      const full = path.resolve(env().UPLOAD_DIR, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, file.buffer, { mode: 0o600 });
    }
    const safeName = file.originalname.replace(/[^\w.\- ()؀-ۿ]/g, '_').slice(0, 120) || `file.${sig.ext}`;
    return this.prisma.attachment.create({
      data: { ownerId, purpose, storageKey: key, fileName: safeName, mimeType: sig.mime, sizeBytes: file.size, sha256, scanStatus: 'SKIPPED', isPrivate: !['AVATAR', 'LOGO'].includes(purpose) },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, purpose: true, isPrivate: true },
    });
  }

  /** Authorisation: owner, admins, conversation participants (messages) or campaign parties (deliverables). */
  async canRead(userId: string | undefined, isAdmin: boolean, attachmentId: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id: attachmentId }, include: { message: { include: { conversation: { include: { participants: true } } } }, deliverable: { include: { campaign: { include: { business: true, influencer: true } } } } } });
    if (!a) throw new NotFoundException();
    if (!a.isPrivate) return a;
    if (!userId) throw new NotFoundException();
    if (isAdmin || a.ownerId === userId) return a;
    if (a.message?.conversation.participants.some((p) => p.userId === userId)) return a;
    const c = a.deliverable?.campaign;
    if (c && (c.business.userId === userId || c.influencer.userId === userId)) return a;
    throw new NotFoundException();
  }

  async read(storageKey: string): Promise<Buffer> {
    if (this.s3) {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: storageKey }));
      return Buffer.from(await r.Body!.transformToByteArray());
    }
    const base = path.resolve(env().UPLOAD_DIR);
    const full = path.resolve(base, storageKey);
    if (!full.startsWith(base + path.sep)) throw new NotFoundException(); // path traversal guard
    return fs.readFile(full);
  }
}
