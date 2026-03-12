import { getT } from '@xpoz/react/translation/get.translation.service.backend';
import { AuthBrandPanel } from './auth.brand.panel';

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
    <div className="relative flex flex-1 p-[16px] md:p-[24px] lg:p-[40px] gap-[16px] min-h-screen w-screen text-white overflow-hidden items-center justify-center bg-[#09090b]">
      {/* 极光背景装饰 */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-30 mix-blend-screen mix-blend-color-dodge filter blur-[100px] pointer-events-none" style={{ background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-20 filter blur-[120px] pointer-events-none" style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }}></div>
      <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full opacity-10 filter blur-[80px] pointer-events-none" style={{ background: 'radial-gradient(circle, #ec4899 0%, transparent 70%)' }}></div>

      <ReturnUrlComponent />

      {/* 超大圆角主内容面板 (毛玻璃特效) */}
      <div className="relative z-10 flex flex-col md:flex-row w-full max-w-[1240px] min-h-[700px] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl backdrop-blur-2xl bg-[#0a0a0a]/50">
        
        {/* 左侧：登录表单区域 */}
        <div className="flex flex-col py-[50px] px-[32px] md:px-[40px] lg:px-[60px] flex-1 text-white relative">
          {/* 表单内层微距光晕 */}
          <div className="absolute top-0 left-[50%] translate-x-[-50%] w-[50%] h-[1px] bg-gradient-to-r from-transparent via-[#6366F1]/50 to-transparent"></div>
          
          <div className="w-full max-w-[420px] mx-auto justify-center gap-[24px] h-full flex flex-col text-white">
            <LogoTextComponent />
            <div className="flex flex-col flex-1">{children}</div>
          </div>
        </div>

        {/* 右侧：XPoz 品牌展示面板（仅 md 及以上屏幕显示）*/}
        <AuthBrandPanel />
      </div>
    </div>
  );
}
