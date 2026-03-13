import { getT } from '@xpoz/react/translation/get.translation.service.backend';

export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@xpoz/frontend/components/ui/logo-text.component';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = await getT();

  return (
    <div className="relative flex flex-1 min-h-screen w-screen text-white overflow-hidden items-center justify-center bg-[#09090b]">
      {/* Aurora background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-20 filter blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-15 filter blur-[100px] pointer-events-none" style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }}></div>
      <div className="absolute top-[30%] right-[30%] w-[20%] h-[20%] rounded-full opacity-10 filter blur-[80px] pointer-events-none" style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }}></div>

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>

      <ReturnUrlComponent />

      {/* Centered auth card */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[460px] mx-auto px-[24px] py-[40px]">
        {/* Logo */}
        <div className="mb-[32px]">
          <LogoTextComponent />
        </div>

        {/* Glassmorphism card */}
        <div className="w-full rounded-[24px] border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl shadow-[0_0_80px_rgba(99,102,241,0.06)] p-[32px] md:p-[40px]">
          {/* Top edge glow */}
          <div className="absolute top-0 left-[20%] right-[20%] h-[1px] bg-gradient-to-r from-transparent via-[#6366F1]/40 to-transparent rounded-full"></div>
          
          <div className="flex flex-col text-white">
            {children}
          </div>
        </div>

        {/* Bottom trust signal */}
        <div className="mt-[24px] text-center text-gray-500 text-[12px]">
          {t('auth_trust_signal', 'Trusted by 20,000+ creators worldwide')}
        </div>
      </div>
    </div>
  );
}
