import { BadRequestException, Body, Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { env } from '../../config/env';
import { AuthUser, CurrentUser, Public } from '../../common/decorators';
import { PrismaService } from '../../common/services/prisma.service';
import { UploadsService, UploadPurpose } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly svc: UploadsService, private readonly prisma: PrismaService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024, files: 1 } }))
  async upload(@CurrentUser() u: AuthUser, @UploadedFile() file: { buffer: Buffer; originalname: string; size: number }, @Body('purpose') purpose: string) {
    if (!['AVATAR', 'LOGO', 'MESSAGE', 'DELIVERABLE', 'VERIFICATION'].includes(purpose)) throw new BadRequestException({ code: 'INVALID_PURPOSE' });
    const a = await this.svc.store(u.id, file, purpose as UploadPurpose);
    const url = `${env().API_PUBLIC_URL}/uploads/${a.id}`;
    if (purpose === 'AVATAR') await this.prisma.influencerProfile.updateMany({ where: { userId: u.id }, data: { profileImageUrl: url } });
    if (purpose === 'LOGO') await this.prisma.businessProfile.updateMany({ where: { userId: u.id }, data: { logoUrl: url } });
    return { ...a, url };
  }

  @Public()
  @Get(':id')
  async download(@CurrentUser() u: AuthUser | undefined, @Param('id') id: string, @Res() res: Response) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException();
    const a = await this.svc.canRead(u?.id, u?.type === 'ADMIN', id);
    const buf = await this.svc.read(a.storageKey);
    res.setHeader('Content-Type', a.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', a.isPrivate ? 'private, no-store' : 'public, max-age=86400');
    res.setHeader('Content-Disposition', `${a.mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    res.send(buf);
  }
}
