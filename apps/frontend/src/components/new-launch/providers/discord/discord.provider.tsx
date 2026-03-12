'use client';

import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { FC } from 'react';
import { DiscordDto } from '@xpoz/nestjs-libraries/dtos/posts/providers-settings/discord.dto';
import { DiscordChannelSelect } from '@xpoz/frontend/components/new-launch/providers/discord/discord.channel.select';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
const DiscordComponent: FC = () => {
  const form = useSettings();
  return (
    <div>
      <DiscordChannelSelect {...form.register('channel')} />
    </div>
  );
};
export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: DiscordComponent,
  CustomPreviewComponent: undefined,
  dto: DiscordDto,
  checkValidity: undefined,
  maximumCharacters: 1980,
});
