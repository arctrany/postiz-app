import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { PostsService } from '@xpoz/nestjs-libraries/database/prisma/posts/posts.service';
import {
  NotificationService,
  NotificationType,
} from '@xpoz/nestjs-libraries/database/prisma/notifications/notification.service';
import { Integration, Post, State } from '@prisma/client';
import { stripHtmlValidation } from '@xpoz/helpers/utils/strip.html.validation';
import { IntegrationManager } from '@xpoz/nestjs-libraries/integrations/integration.manager';
import { AuthTokenDetails } from '@xpoz/nestjs-libraries/integrations/social/social.integrations.interface';
import { RefreshIntegrationService } from '@xpoz/nestjs-libraries/integrations/refresh.integration.service';
import { timer } from '@xpoz/helpers/utils/timer';
import { IntegrationService } from '@xpoz/nestjs-libraries/database/prisma/integrations/integration.service';
import { WebhooksService } from '@xpoz/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { AutopostService } from '@xpoz/nestjs-libraries/database/prisma/autopost/autopost.service';

@Injectable()
@Activity()
export class AutopostActivity {
  constructor(private _autoPostService: AutopostService) {}

  @ActivityMethod()
  async autoPost(id: string) {
    return this._autoPostService.startAutopost(id)
  }
}
