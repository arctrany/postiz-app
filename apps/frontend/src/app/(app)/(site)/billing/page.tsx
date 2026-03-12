export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: `${'XPoz'} Billing`,
  description: '',
};
export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px] items-center justify-center">
      <div className="flex flex-col items-center gap-[16px] text-center max-w-[480px]">
        <div className="text-[48px]">🚀</div>
        <h1 className="text-[28px] font-[700]">ULTIMATE Plan</h1>
        <p className="text-textItemBlur text-[16px]">
          You have full access to all XPoz features — unlimited channels,
          posts, team members, AI, and more.
        </p>
      </div>
    </div>
  );
}
