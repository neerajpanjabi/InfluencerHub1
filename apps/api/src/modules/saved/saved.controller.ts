import { Controller, Delete, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { PrismaService } from '../../common/services/prisma.service';
import { applyVisibility, PUBLIC_CARD_SELECT } from '../influencers/search.service';

@Injectable()
export class SavedService {
  constructor(private readonly prisma: PrismaService) {}
  private async biz(userId: string) {
    const b = await this.prisma.businessProfile.findUnique({ where: { userId } });
    if (!b) throw new ForbiddenException();
    return b;
  }
  async list(userId: string) {
    const b = await this.biz(userId);
    const rows = await this.prisma.savedInfluencer.findMany({ where: { businessId: b.id }, orderBy: { createdAt: 'desc' }, include: { influencer: { select: PUBLIC_CARD_SELECT } } });
    return rows.map((r) => ({ savedAt: r.createdAt, note: r.note, influencer: applyVisibility(r.influencer) }));
  }
  async save(userId: string, influencerId: string) {
    const b = await this.biz(userId);
    const inf = await this.prisma.influencerProfile.findFirst({ where: { id: influencerId, isPublic: true, deletedAt: null } });
    if (!inf) throw new NotFoundException();
    await this.prisma.savedInfluencer.upsert({ where: { businessId_influencerId: { businessId: b.id, influencerId } }, update: {}, create: { businessId: b.id, influencerId } });
    return { saved: true };
  }
  async remove(userId: string, influencerId: string) {
    const b = await this.biz(userId);
    await this.prisma.savedInfluencer.deleteMany({ where: { businessId: b.id, influencerId } });
    return { saved: false };
  }
}

@ApiTags('saved')
@UserTypes('BUSINESS')
@Controller('saved')
export class SavedController {
  constructor(private readonly svc: SavedService) {}
  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }
  @Put(':influencerId')
  save(@CurrentUser() u: AuthUser, @Param('influencerId') id: string) {
    return this.svc.save(u.id, id);
  }
  @Delete(':influencerId')
  remove(@CurrentUser() u: AuthUser, @Param('influencerId') id: string) {
    return this.svc.remove(u.id, id);
  }
}

@Module({ controllers: [SavedController], providers: [SavedService] })
export class SavedModule {}
