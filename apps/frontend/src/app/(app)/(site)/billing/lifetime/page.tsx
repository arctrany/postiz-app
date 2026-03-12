import { LifetimeDeal } from '@xpoz/frontend/components/billing/lifetime.deal';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Lifetime deal`,
  description: '',
};
export default async function Page() {
  return <LifetimeDeal />;
}
