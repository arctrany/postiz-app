export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { AfterActivate } from '@xpoz/frontend/components/auth/after.activate';
import { isGeneralServerSide } from '@xpoz/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${
    'XPoz'
  } - Activate your account`,
  description: '',
};
export default async function Auth() {
  return <AfterActivate />;
}
