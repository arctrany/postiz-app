'use client';

import { FC } from 'react';
import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
import { Input } from '@xpoz/react/form/input';
import { HashnodePublications } from '@xpoz/frontend/components/new-launch/providers/hashnode/hashnode.publications';
import { HashnodeTags } from '@xpoz/frontend/components/new-launch/providers/hashnode/hashnode.tags';
import { HashnodeSettingsDto } from '@xpoz/nestjs-libraries/dtos/posts/providers-settings/hashnode.settings.dto';
import { useIntegration } from '@xpoz/frontend/components/launches/helpers/use.integration';
import { useMediaDirectory } from '@xpoz/react/helpers/use.media.directory';
import clsx from 'clsx';
import { MediaComponent } from '@xpoz/frontend/components/media/media.component';
import { Canonical } from '@xpoz/react/form/canonical';

const HashnodeSettings: FC = () => {
  const form = useSettings();
  const { date } = useIntegration();
  return (
    <>
      <Input label="Title" {...form.register('title')} />
      <Input label="Subtitle" {...form.register('subtitle')} />
      <Canonical
        date={date}
        label="Canonical Link"
        {...form.register('canonical')}
      />
      <MediaComponent
        label="Cover picture"
        description="Add a cover picture"
        {...form.register('main_image')}
      />
      <div className="mt-[20px]">
        <HashnodePublications {...form.register('publication')} />
      </div>
      <div>
        <HashnodeTags label="Tags" {...form.register('tags')} />
      </div>
    </>
  );
};
export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: HashnodeSettings,
  CustomPreviewComponent: undefined, // HashnodePreview,
  dto: HashnodeSettingsDto,
  checkValidity: undefined,
  maximumCharacters: 10000,
});
