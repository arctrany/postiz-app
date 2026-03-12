import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@xpoz/nestjs-libraries/database/prisma/database.module';
import { ApiModule } from '@xpoz/backend/api/api.module';
import { APP_GUARD } from '@nestjs/core';
import { PoliciesGuard } from '@xpoz/backend/services/auth/permissions/permissions.guard';
import { PublicApiModule } from '@xpoz/backend/public-api/public.api.module';
import { ThrottlerBehindProxyGuard } from '@xpoz/nestjs-libraries/throttler/throttler.provider';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentModule } from '@xpoz/nestjs-libraries/agent/agent.module';
import { ThirdPartyModule } from '@xpoz/nestjs-libraries/3rdparties/thirdparty.module';
import { VideoModule } from '@xpoz/nestjs-libraries/videos/video.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { FILTER } from '@xpoz/nestjs-libraries/sentry/sentry.exception';
import { ChatModule } from '@xpoz/nestjs-libraries/chat/chat.module';
import { getTemporalModule } from '@xpoz/nestjs-libraries/temporal/temporal.module';
import { TemporalRegisterMissingSearchAttributesModule } from '@xpoz/nestjs-libraries/temporal/temporal.register';
import { InfiniteWorkflowRegisterModule } from '@xpoz/nestjs-libraries/temporal/infinite.workflow.register';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ioRedis } from '@xpoz/nestjs-libraries/redis/redis.service';

@Global()
@Module({
  imports: [
    SentryModule.forRoot(),
    DatabaseModule,
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThirdPartyModule,
    VideoModule,
    ChatModule,
    getTemporalModule(false),
    TemporalRegisterMissingSearchAttributesModule,
    InfiniteWorkflowRegisterModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600000,
          limit: process.env.API_LIMIT ? Number(process.env.API_LIMIT) : 30,
        },
      ],
      storage: new ThrottlerStorageRedisService(ioRedis),
    }),
  ],
  controllers: [],
  providers: [
    FILTER,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
  exports: [
    DatabaseModule,
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThrottlerModule,
    ChatModule,
  ],
})
export class AppModule {}
