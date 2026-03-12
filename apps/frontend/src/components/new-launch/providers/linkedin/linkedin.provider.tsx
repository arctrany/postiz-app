'use client';

import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
import { Checkbox } from '@xpoz/react/form/checkbox';
import { Input } from '@xpoz/react/form/input';
import { useT } from '@xpoz/react/translation/get.transation.service.client';
import { useSettings } from '@xpoz/frontend/components/launches/helpers/use.values';
import { LinkedinDto } from '@xpoz/nestjs-libraries/dtos/posts/providers-settings/linkedin.dto';
import { LinkedinPreview } from '@xpoz/frontend/components/new-launch/providers/linkedin/linkedin.preview';

const LinkedInSettings = () => {
  const t = useT();
  const { watch, register, formState, control } = useSettings();
  const isCarousel = watch('post_as_images_carousel');

  return (
    <div className="mb-[20px]">
      <Checkbox
        variant="hollow"
        label={t('post_as_images_carousel', 'Post as images carousel')}
        {...register('post_as_images_carousel', {
          value: false,
        })}
      />
      {isCarousel && (
        <div className="mt-[10px]">
          <Input
            label={t('carousel_name', 'Carousel slide name')}
            placeholder="slides"
            {...register('carousel_name')}
          />
        </div>
      )}
    </div>
  );
};
export default withProvider<LinkedinDto>({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: LinkedInSettings,
  CustomPreviewComponent: LinkedinPreview,
  dto: LinkedinDto,
  checkValidity: async (posts, vals) => {
    const [firstPost, ...restPosts] = posts ?? [];

    if (
      vals?.post_as_images_carousel &&
      ((firstPost?.length ?? 0) < 2 ||
        firstPost?.some((p) => (p?.path?.indexOf?.('mp4') ?? -1) > -1))
    ) {
      return 'Carousel can only be created with 2 or more images and no videos.';
    }

    if (
      (firstPost?.length ?? 0) > 1 &&
      firstPost?.some((p) => (p?.path?.indexOf?.('mp4') ?? -1) > -1)
    ) {
      return 'Can have maximum 1 media when selecting a video.';
    }
    if (restPosts?.some((p) => (p?.length ?? 0) > 0)) {
      return 'Comments can only contain text.';
    }
    return true;
  },
  maximumCharacters: 3000,
});
