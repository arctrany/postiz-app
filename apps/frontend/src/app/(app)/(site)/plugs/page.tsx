import { Plugs } from '@xpoz/frontend/components/plugs/plugs';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Plugs`,
  description: '',
};
export default async function Index() {
  return <Plugs />;
}
