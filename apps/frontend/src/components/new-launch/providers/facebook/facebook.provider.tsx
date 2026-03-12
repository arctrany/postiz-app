'use client';

import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { FacebookDto } from '@xpoz/nestjs-libraries/dtos/posts/providers-settings/facebook.dto';
import { Input } from '@xpoz/react/form/input';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
import { FacebookPreview } from '@xpoz/frontend/components/new-launch/providers/facebook/facebook.preview';

export const FacebookSettings = () => {
  const { register } = useSettings();

  return (
    <Input
      label={
        'Embedded URL (only for text Post)'
      }
      {...register('url')}
    />
  );
};

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: FacebookSettings,
  CustomPreviewComponent: FacebookPreview,
  dto: FacebookDto,
  checkValidity: undefined,
  maximumCharacters: 63206,
});
