import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'XPoz - Agent',
  description: '',
};

export default async function Page() {
  return redirect('/agents/new');
}
