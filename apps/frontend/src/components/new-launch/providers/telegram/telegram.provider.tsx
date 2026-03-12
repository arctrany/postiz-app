'use client';

import {
  PostComment,
  withProvider,
} from '@xpoz/frontend/components/new-launch/providers/high.order.provider';
export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: null,
  CustomPreviewComponent: undefined,
  dto: undefined,
  checkValidity: async () => {
    return true;
  },
  maximumCharacters: 4096,
});
