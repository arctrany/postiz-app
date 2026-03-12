export const dynamic = 'force-dynamic';
import { Forgot } from '@xpoz/frontend/components/auth/forgot';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Forgot Password`,
  description: '',
};
export default async function Auth() {
  return <Forgot />;
}
