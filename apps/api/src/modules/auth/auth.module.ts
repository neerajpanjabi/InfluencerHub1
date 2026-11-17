import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthStateService } from './oauth-state.service';

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, OAuthStateService], exports: [AuthService, OAuthStateService] })
export class AuthModule {}
