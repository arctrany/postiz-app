import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from '@xpoz/backend/services/auth/auth.service';
import { StripeService } from '@xpoz/nestjs-libraries/services/stripe.service';
import { PoliciesGuard } from '@xpoz/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@xpoz/backend/services/auth/permissions/permissions.service';
import { IntegrationManager } from '@xpoz/nestjs-libraries/integrations/integration.manager';
import { UploadModule } from '@xpoz/nestjs-libraries/upload/upload.module';
import { OpenaiService } from '@xpoz/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@xpoz/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@xpoz/nestjs-libraries/services/codes.service';
import { PublicIntegrationsController } from '@xpoz/backend/public-api/routes/v1/public.integrations.controller';
import { PublicAuthMiddleware } from '@xpoz/backend/services/auth/public.auth.middleware';

const authenticatedController = [PublicIntegrationsController];
@Module({
  imports: [UploadModule],
  controllers: [...authenticatedController],
  providers: [
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class PublicApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicAuthMiddleware).forRoutes(...authenticatedController);
  }
}

