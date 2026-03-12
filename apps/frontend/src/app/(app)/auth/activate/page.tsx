export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { Activate } from '@xpoz/frontend/components/auth/activate';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${
    'XPoz'
  } - Activate your account`,
  description: '',
};
export default async function Auth() {
  return <Activate />;
}
