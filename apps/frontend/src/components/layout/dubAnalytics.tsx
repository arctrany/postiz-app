'use client';

import { useVariables } from '@xpoz/react/helpers/variable.context';
// import { Analytics as DubAnalyticsIn } from '@dub/analytics/react';
import { getCookie } from 'react-use-cookie';

export const DubAnalytics = (): null => {
  return null;
};

export const useDubClickId = (): string | undefined => {
  const { dub } = useVariables();
  if (!dub) return undefined;

  const dubCookie = getCookie('dub_partner_data', '{}');
  return JSON.parse(dubCookie)?.clickId || undefined;
};
