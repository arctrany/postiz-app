import { SettingsPopup } from '@xpoz/frontend/components/layout/settings.component';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Settings`,
  description: '',
};
export default async function Index({
  searchParams,
}: {
  searchParams: {
    code: string;
  };
}) {
  return <SettingsPopup />;
}
