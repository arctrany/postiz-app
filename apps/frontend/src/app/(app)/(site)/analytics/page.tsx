export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@xpoz/frontend/components/platform-analytics/platform.analytics';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Analytics`,
  description: '',
};
export default async function Index() {
  return <PlatformAnalytics />;
}
