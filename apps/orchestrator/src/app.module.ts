import { Module } from '@nestjs/common';
import { PostActivity } from '@xpoz/orchestrator/activities/post.activity';
import { getTemporalModule } from '@xpoz/nestjs-libraries/temporal/temporal.module';
import { DatabaseModule } from '@xpoz/nestjs-libraries/database/prisma/database.module';
import { AutopostService } from '@xpoz/nestjs-libraries/database/prisma/autopost/autopost.service';
import { EmailActivity } from '@xpoz/orchestrator/activities/email.activity';
import { IntegrationsActivity } from '@xpoz/orchestrator/activities/integrations.activity';

const activities = [
  PostActivity,
  AutopostService,
  EmailActivity,
  IntegrationsActivity,
];
@Module({
  imports: [
    DatabaseModule,
    getTemporalModule(true, require.resolve('./workflows'), activities),
  ],
  controllers: [],
  providers: [...activities],
  get exports() {
    return [...this.providers, ...this.imports];
  },
})
export class AppModule {}
