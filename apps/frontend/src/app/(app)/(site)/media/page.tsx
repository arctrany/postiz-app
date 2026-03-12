import { MediaLayoutComponent } from '@xpoz/frontend/components/new-layout/layout.media.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${'XPoz'} Media`,
  description: '',
};

export default async function Page() {
  return <MediaLayoutComponent />
}
