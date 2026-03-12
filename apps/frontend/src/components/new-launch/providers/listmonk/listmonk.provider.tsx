'use client';

import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { ListmonkDto } from '@xpoz/nestjs-libraries/dtos/posts/providers-settings/listmonk.dto';
import { Input } from '@xpoz/react/form/input';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
import { SelectList } from '@xpoz/frontend/components/new-launch/providers/listmonk/select.list';
import { SelectTemplates } from '@xpoz/frontend/components/new-launch/providers/listmonk/select.templates';

const SettingsComponent = () => {
  const form = useSettings();

  return (
    <>
      <Input label="Subject" {...form.register('subject')} />
      <Input label="Preview" {...form.register('preview')} />
      <SelectList {...form.register('list')} />
      <SelectTemplates {...form.register('template')} />
    </>
  );
};

export default withProvider({
  postComment: PostComment.POST,
  minimumCharacters: [],
  SettingsComponent: SettingsComponent,
  CustomPreviewComponent: undefined,
  dto: ListmonkDto,
  checkValidity: undefined,
  maximumCharacters: 300000,
});
