'use client';

/**
 * XPoz 登录页右侧品牌展示面板
 *
 * 展示 XPoz 的核心价值主张：
 * - 支持 55+ 全球 + 25 个国内平台
 * - 智能调度 / AI 驱动 / 多平台一键发布
 */
import { FC } from 'react';

const FEATURES = [
  {
    icon: (
      <div className="relative w-[32px] h-[32px] flex justify-center items-center">
        {/* 背景弥散光 */}
        <div className="absolute inset-0 bg-[#6366F1]/30 rounded-full blur-[6px]" />
        {/* 几何结构：同心圆 */}
        <div className="w-[18px] h-[18px] border-[1.5px] border-[#818CF8] rounded-full z-10 flex items-center justify-center">
          <div className="w-[6px] h-[6px] bg-white rounded-full shadow-[0_0_8px_white]" />
        </div>
      </div>
    ),
    title: '全平台矩阵发布',
    desc: 'Twitter、微信、小红书等国内外 55+ 平台一键触达同步',
  },
  {
    icon: (
      <div className="relative w-[32px] h-[32px] flex justify-center items-center">
        {/* 背景弥散光 */}
        <div className="absolute inset-0 bg-[#ec4899]/30 rounded-[8px] rotate-45 blur-[6px]" />
        {/* 几何结构：发光棱镜/星芒抽象 */}
        <div className="w-[18px] h-[18px] border-[1.5px] border-[#F472B6] rotate-45 z-10 relative box-border">
          <div className="absolute top-1/2 left-[-4px] right-[-4px] h-[1px] bg-white/70 -translate-y-1/2" />
          <div className="absolute left-1/2 top-[-4px] bottom-[-4px] w-[1px] bg-white/70 -translate-x-1/2" />
        </div>
      </div>
    ),
    title: '智能内容衍生',
    desc: '从创作到分发，结构化重塑每一次思想脉络的传播',
  },
  {
    icon: (
      <div className="relative w-[32px] h-[32px] flex justify-center items-center">
        {/* 背景弥散光 */}
        <div className="absolute inset-0 bg-emerald-500/30 rounded-md blur-[6px]" />
        {/* 几何结构：阶梯数据条 */}
        <div className="flex gap-[3px] items-end h-[16px] z-10">
          <div className="w-[3px] h-[6px] bg-emerald-400 rounded-sm" />
          <div className="w-[3px] h-[10px] bg-emerald-300 rounded-sm" />
          <div className="w-[3px] h-[16px] bg-white rounded-sm shadow-[0_0_8px_white]" />
        </div>
      </div>
    ),
    title: '时序精准调度',
    desc: '工业级可视化日历驱动，多通道任务队列零延迟投递',
  },
  {
    icon: (
      <div className="relative w-[32px] h-[32px] flex justify-center items-center">
        {/* 背景弥散光 */}
        <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-[6px]" />
        {/* 几何结构：抽象轨道/数据透视 */}
        <div className="w-[18px] h-[18px] rounded-full border border-amber-400/50 z-10 relative overflow-hidden flex items-center justify-center">
          <div className="w-[24px] h-[1px] bg-amber-200 rotate-[-45deg] absolute" />
          <div className="w-[4px] h-[4px] bg-white rounded-full absolute bottom-[3px] right-[4px] shadow-[0_0_6px_white]" />
        </div>
      </div>
    ),
    title: '全维数据追踪',
    desc: '穿透跨平台数据孤岛，高精度洞察每一次曝光与转化',
  },
];

const PLATFORM_ICONS = [
  { name: 'X', color: '#000', label: 'X' },
  { name: '微博', color: '#E6162D', label: '微博' },
  { name: '微信', color: '#07C160', label: '微信' },
  { name: '知乎', color: '#0066FF', label: '知乎' },
  { name: '小红书', color: '#FF2442', label: '小红书' },
  { name: 'LI', color: '#0A66C2', label: 'LinkedIn' },
  { name: '掘金', color: '#1E80FF', label: '掘金' },
  { name: 'B站', color: '#00A1D6', label: 'B站' },
];

export const AuthBrandPanel: FC = () => {
  return (
    <div className="hidden md:flex flex-col flex-1 relative p-[40px] md:p-[60px] justify-center">
      {/* 背景装饰光晕改为微弱的发光源 */}
      <div className="absolute top-[10%] right-[10%] w-[400px] h-[400px] rounded-full opacity-10 bg-[#6366F1] filter blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-[300px] h-[300px] rounded-full opacity-[0.15] bg-[#8B5CF6] filter blur-[100px] pointer-events-none" />

      {/* Logo + Slogan */}
      <div className="relative z-10 mb-[40px]">
        <div className="flex items-center gap-[10px] mb-[12px]">
          <div
            className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center text-white font-bold text-[16px]"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
          >
            X
          </div>
          <span className="text-white text-[22px] font-bold tracking-tight">XPoz</span>
        </div>
        <h2 className="text-white text-[28px] font-[700] leading-[1.3] mb-[8px]">
          一个平台，<br />触达全球受众
        </h2>
        <p className="text-gray-400 text-[14px] leading-[1.6]">
          国内外 55+ 社交平台同步发布<br />
          AI 助力内容创作，智能驱动增长
        </p>
      </div>

      {/* 功能特性卡片 */}
      <div className="relative z-10 flex flex-col gap-[12px] flex-1">
        {FEATURES.map((f) => (
          <div
            key={f.icon}
            className="flex gap-[16px] items-start p-[16px] rounded-[16px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-[24px] mt-[2px] opacity-90">{f.icon}</span>
            <div>
              <div className="text-white text-[14px] font-[600] tracking-wide mb-[4px]">{f.title}</div>
              <div className="text-gray-400 text-[13px] leading-[1.6] font-[400]">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 平台 icons 展示 */}
      <div className="relative z-10 mt-[24px]">
        <div className="text-gray-500 text-[11px] mb-[10px] uppercase tracking-widest">
          已支持平台
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {PLATFORM_ICONS.map((p) => (
            <div
              key={p.name}
              title={p.label}
              className="w-[36px] h-[36px] rounded-[10px] flex items-center justify-center text-white text-[11px] font-bold shadow-lg ring-1 ring-white/10 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: p.color, opacity: 0.95 }}
            >
              {p.name.substring(0, 2)}
            </div>
          ))}
          <div className="h-[36px] px-[12px] rounded-[10px] flex items-center text-gray-400 text-[12px] font-[500] bg-white/5 ring-1 ring-white/10">
            +47 更多
          </div>
        </div>
      </div>
    </div>
  );
};
