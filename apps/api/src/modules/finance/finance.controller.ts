import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, UserTypes } from '../../common/decorators';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@UserTypes('INFLUENCER')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('earnings')
  earnings(@CurrentUser() u: AuthUser) {
    return this.finance.earnings(u.id);
  }
}
