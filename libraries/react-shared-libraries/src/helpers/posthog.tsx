'use client';

import { FC, ReactNode } from 'react';

/**
 * PostHog provider removed for XPoz — no external analytics tracking.
 * This component is kept as a passthrough to avoid breaking imports.
 */
export const PHProvider: FC<{
  children: ReactNode;
  phkey?: string;
  host?: string;
}> = ({ children }) => {
  return <>{children}</>;
};
