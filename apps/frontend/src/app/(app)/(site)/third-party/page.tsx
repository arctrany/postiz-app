import { ThirdPartyComponent } from '@xpoz/frontend/components/third-parties/third-party.component';

export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${
    'XPoz Integrations'
  }`,
  description: '',
};
export default async function Index() {
  return <ThirdPartyComponent />;
}
