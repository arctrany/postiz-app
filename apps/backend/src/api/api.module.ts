import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from '@xpoz/backend/api/routes/auth.controller';
import { AuthService } from '@xpoz/backend/services/auth/auth.service';
import { UsersController } from '@xpoz/backend/api/routes/users.controller';
import { AuthMiddleware } from '@xpoz/backend/services/auth/auth.middleware';
import { StripeController } from '@xpoz/backend/api/routes/stripe.controller';
import { StripeService } from '@xpoz/nestjs-libraries/services/stripe.service';
import { AnalyticsController } from '@xpoz/backend/api/routes/analytics.controller';
import { PoliciesGuard } from '@xpoz/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@xpoz/backend/services/auth/permissions/permissions.service';
import { IntegrationsController } from '@xpoz/backend/api/routes/integrations.controller';
import { IntegrationManager } from '@xpoz/nestjs-libraries/integrations/integration.manager';
import { SettingsController } from '@xpoz/backend/api/routes/settings.controller';
import { PostsController } from '@xpoz/backend/api/routes/posts.controller';
import { MediaController } from '@xpoz/backend/api/routes/media.controller';
import { UploadModule } from '@xpoz/nestjs-libraries/upload/upload.module';
import { BillingController } from '@xpoz/backend/api/routes/billing.controller';
import { NotificationsController } from '@xpoz/backend/api/routes/notifications.controller';
import { OpenaiService } from '@xpoz/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@xpoz/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@xpoz/nestjs-libraries/services/codes.service';
import { CopilotController } from '@xpoz/backend/api/routes/copilot.controller';
import { PublicController } from '@xpoz/backend/api/routes/public.controller';
import { RootController } from '@xpoz/backend/api/routes/root.controller';
import { TrackService } from '@xpoz/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@xpoz/nestjs-libraries/short-linking/short.link.service';
import { Nowpayments } from '@xpoz/nestjs-libraries/crypto/nowpayments';
import { WebhookController } from '@xpoz/backend/api/routes/webhooks.controller';
import { SignatureController } from '@xpoz/backend/api/routes/signature.controller';
import { AutopostController } from '@xpoz/backend/api/routes/autopost.controller';
import { SetsController } from '@xpoz/backend/api/routes/sets.controller';
import { ThirdPartyController } from '@xpoz/backend/api/routes/third-party.controller';
import { MonitorController } from '@xpoz/backend/api/routes/monitor.controller';
import { NoAuthIntegrationsController } from '@xpoz/backend/api/routes/no.auth.integrations.controller';
import { EnterpriseController } from '@xpoz/backend/api/routes/enterprise.controller';
import { OAuthAppController } from '@xpoz/backend/api/routes/oauth-app.controller';
import { ApprovedAppsController } from '@xpoz/backend/api/routes/approved-apps.controller';
import { OAuthController, OAuthAuthorizedController } from '@xpoz/backend/api/routes/oauth.controller';
import { AuthProviderManager } from '@xpoz/backend/services/auth/providers/providers.manager';
import { GithubProvider } from '@xpoz/backend/services/auth/providers/github.provider';
import { GoogleProvider } from '@xpoz/backend/services/auth/providers/google.provider';
import { FarcasterProvider } from '@xpoz/backend/services/auth/providers/farcaster.provider';
import { WalletProvider } from '@xpoz/backend/services/auth/providers/wallet.provider';
import { OauthProvider } from '@xpoz/backend/services/auth/providers/oauth.provider';
import { McpController, McpPublicController } from '@xpoz/backend/api/routes/mcp.controller';

const authenticatedController = [
  UsersController,
  AnalyticsController,
  IntegrationsController,
  SettingsController,
  PostsController,
  MediaController,
  BillingController,
  NotificationsController,
  CopilotController,
  WebhookController,
  SignatureController,
  AutopostController,
  SetsController,
  ThirdPartyController,
  OAuthAppController,
  ApprovedAppsController,
  OAuthAuthorizedController,
  McpController,
];
@Module({
  imports: [UploadModule],
  controllers: [
    RootController,
    StripeController,
    AuthController,
    PublicController,
    MonitorController,
    EnterpriseController,
    NoAuthIntegrationsController,
    OAuthController,
    McpPublicController,
    ...authenticatedController,
  ],
  providers: [
    AuthService,
    StripeService,
    OpenaiService,
    ExtractContentService,
    AuthMiddleware,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
    TrackService,
    ShortLinkService,
    Nowpayments,
    AuthProviderManager,
    GithubProvider,
    GoogleProvider,
    FarcasterProvider,
    WalletProvider,
    OauthProvider,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
