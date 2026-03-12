import { Global, Module } from '@nestjs/common';
import { PrismaRepository, PrismaService, PrismaTransaction } from './prisma.service';
import { OrganizationRepository } from '@xpoz/nestjs-libraries/database/prisma/organizations/organization.repository';
import { OrganizationService } from '@xpoz/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@xpoz/nestjs-libraries/database/prisma/users/users.service';
import { UsersRepository } from '@xpoz/nestjs-libraries/database/prisma/users/users.repository';
import { SubscriptionService } from '@xpoz/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { SubscriptionRepository } from '@xpoz/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { NotificationService } from '@xpoz/nestjs-libraries/database/prisma/notifications/notification.service';
import { IntegrationService } from '@xpoz/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationRepository } from '@xpoz/nestjs-libraries/database/prisma/integrations/integration.repository';
import { PostsService } from '@xpoz/nestjs-libraries/database/prisma/posts/posts.service';
import { PostsRepository } from '@xpoz/nestjs-libraries/database/prisma/posts/posts.repository';
import { IntegrationManager } from '@xpoz/nestjs-libraries/integrations/integration.manager';
import { MediaService } from '@xpoz/nestjs-libraries/database/prisma/media/media.service';
import { MediaRepository } from '@xpoz/nestjs-libraries/database/prisma/media/media.repository';
import { NotificationsRepository } from '@xpoz/nestjs-libraries/database/prisma/notifications/notifications.repository';
import { EmailService } from '@xpoz/nestjs-libraries/services/email.service';
import { StripeService } from '@xpoz/nestjs-libraries/services/stripe.service';
import { ExtractContentService } from '@xpoz/nestjs-libraries/openai/extract.content.service';
import { OpenaiService } from '@xpoz/nestjs-libraries/openai/openai.service';
import { AgenciesService } from '@xpoz/nestjs-libraries/database/prisma/agencies/agencies.service';
import { AgenciesRepository } from '@xpoz/nestjs-libraries/database/prisma/agencies/agencies.repository';
import { TrackService } from '@xpoz/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@xpoz/nestjs-libraries/short-linking/short.link.service';
import { WebhooksRepository } from '@xpoz/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksService } from '@xpoz/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { SignatureRepository } from '@xpoz/nestjs-libraries/database/prisma/signatures/signature.repository';
import { SignatureService } from '@xpoz/nestjs-libraries/database/prisma/signatures/signature.service';
import { AutopostRepository } from '@xpoz/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { AutopostService } from '@xpoz/nestjs-libraries/database/prisma/autopost/autopost.service';
import { SetsService } from '@xpoz/nestjs-libraries/database/prisma/sets/sets.service';
import { SetsRepository } from '@xpoz/nestjs-libraries/database/prisma/sets/sets.repository';
import { ThirdPartyRepository } from '@xpoz/nestjs-libraries/database/prisma/third-party/third-party.repository';
import { ThirdPartyService } from '@xpoz/nestjs-libraries/database/prisma/third-party/third-party.service';
import { VideoManager } from '@xpoz/nestjs-libraries/videos/video.manager';
import { FalService } from '@xpoz/nestjs-libraries/openai/fal.service';
import { ImageGenerationService } from '@xpoz/nestjs-libraries/openai/image/image-generation.service';
import { RefreshIntegrationService } from '@xpoz/nestjs-libraries/integrations/refresh.integration.service';
import { OAuthRepository } from '@xpoz/nestjs-libraries/database/prisma/oauth/oauth.repository';
import { OAuthService } from '@xpoz/nestjs-libraries/database/prisma/oauth/oauth.service';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    PrismaService,
    PrismaRepository,
    PrismaTransaction,
    UsersService,
    UsersRepository,
    OrganizationService,
    OrganizationRepository,
    SubscriptionService,
    SubscriptionRepository,
    NotificationService,
    NotificationsRepository,
    WebhooksRepository,
    WebhooksService,
    IntegrationService,
    IntegrationRepository,
    PostsService,
    PostsRepository,
    StripeService,
    SignatureRepository,
    AutopostRepository,
    AutopostService,
    SignatureService,
    MediaService,
    MediaRepository,
    AgenciesService,
    AgenciesRepository,
    IntegrationManager,
    RefreshIntegrationService,
    ExtractContentService,
    OpenaiService,
    FalService,
    ImageGenerationService,
    EmailService,
    TrackService,
    ShortLinkService,
    SetsService,
    SetsRepository,
    ThirdPartyRepository,
    ThirdPartyService,
    OAuthRepository,
    OAuthService,
    VideoManager,
  ],
  get exports() {
    return this.providers;
  },
})
export class DatabaseModule {}
