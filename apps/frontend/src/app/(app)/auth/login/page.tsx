export const dynamic = 'force-dynamic';
import { Login } from '@xpoz/frontend/components/auth/login';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${'XPoz'} Login`,
  description: '',
};
export default async function Auth() {
  return <Login />;
}
