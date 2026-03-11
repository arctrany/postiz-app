import React from 'react';

export const LogoTextComponent = () => {
  return (
    <div className="flex items-center gap-2">
      <img
        src="/xpoz-logo.png"
        alt="XPoz"
        width={33}
        height={33}
      />
      <span
        style={{
          fontSize: '20px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #612BD3, #4A90D9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        XPoz
      </span>
    </div>
  );
};
