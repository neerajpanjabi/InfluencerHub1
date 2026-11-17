import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async tree() {
    const all = await this.prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] });
    const counts = await this.prisma.influencerCategory.groupBy({ by: ['categoryId'], where: { influencer: { isPublic: true, deletedAt: null } }, _count: true });
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));
    const roots = all.filter((c) => !c.parentId);
    return roots.map((r) => ({
      ...r,
      influencerCount: countMap.get(r.id) ?? 0,
      children: all.filter((c) => c.parentId === r.id).map((c) => ({ ...c, influencerCount: countMap.get(c.id) ?? 0 })),
    }));
  }

  bySlug(slug: string) {
    return this.prisma.category.findUnique({ where: { slug }, include: { children: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } }, parent: true } });
  }
}

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}
  @Public()
  @Get()
  tree() {
    return this.svc.tree();
  }
  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.svc.bySlug(slug);
  }
}

@Module({ controllers: [CategoriesController], providers: [CategoriesService], exports: [CategoriesService] })
export class CategoriesModule {}
