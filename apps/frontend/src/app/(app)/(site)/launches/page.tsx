export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@xpoz/frontend/components/launches/launches.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz Calendar'}`,
  description: '',
};
export default async function Index() {
  return <LaunchesComponent />;
}
