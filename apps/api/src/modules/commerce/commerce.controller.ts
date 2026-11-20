import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { zbody } from '../../common/pipes/zod.pipe';
import { CommerceService } from './commerce.service';
import { ContactService } from '../contact/contact.service';

const addSchema = z.object({
  type: z.enum(['SERVICE', 'PACKAGE', 'QUOTATION']),
  id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(50).optional(),
  addOnKeys: z.array(z.string().max(40)).max(10).optional(),
  brief: z.string().trim().max(3000).optional(),
});
const checkoutSchema = z.object({ idempotencyKey: z.string().uuid(), discountCode: z.string().trim().max(40).optional(), campaignTitle: z.string().trim().max(120).optional() });

@ApiTags('commerce')
@UserTypes('BUSINESS')
@Controller()
export class CommerceController {
  constructor(private readonly svc: CommerceService, private readonly contact: ContactService) {}

  @Get('cart')
  cart(@CurrentUser() u: AuthUser, @Query('discountCode') code?: string) {
    return this.svc.getCart(u.id, code);
  }
  @Post('cart/items')
  add(@CurrentUser() u: AuthUser, @Body(zbody(addSchema)) dto: z.infer<typeof addSchema>) {
    return this.svc.addItem(u.id, dto);
  }
  @Patch('cart/items/:id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(zbody(z.object({ quantity: z.coerce.number().int().min(1).max(50).optional(), brief: z.string().max(3000).optional() }))) dto: any) {
    return this.svc.updateItem(u.id, id, dto);
  }
  @Delete('cart/items/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.removeItem(u.id, id);
  }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  checkout(@CurrentUser() u: AuthUser, @Body(zbody(checkoutSchema)) dto: z.infer<typeof checkoutSchema>) {
    return this.svc.checkout(u.id, dto);
  }
  @Get('orders')
  orders(@CurrentUser() u: AuthUser) {
    return this.svc.orders(u.id);
  }
  @Get('orders/:id')
  order(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.order(u.id, id);
  }
  @Post('orders/:id/pay')
  pay(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.retryPayment(u.id, id);
  }
  @Get('billing')
  billing(@CurrentUser() u: AuthUser) {
    return this.svc.payments_(u.id);
  }
  @Get('invoices/:id')
  invoice(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.invoice(u.id, id);
  }

  // ── Paid contact
  @Get('contact/:influencerId')
  contactStatus(@CurrentUser() u: AuthUser, @Param('influencerId') id: string) {
    return this.contact.status(u.id, id);
  }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('contact/:influencerId/unlock')
  unlock(@CurrentUser() u: AuthUser, @Param('influencerId') id: string, @Body(zbody(z.object({ useFreeCredit: z.boolean().optional(), idempotencyKey: z.string().uuid() }))) b: { useFreeCredit?: boolean; idempotencyKey: string }) {
    return this.contact.unlock(u.id, id, b);
  }
  @Get('contact-access')
  myAccess(@CurrentUser() u: AuthUser) {
    return this.contact.myPurchases(u.id);
  }
}
