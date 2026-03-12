import { useCallback } from 'react';
import { useVariables } from '@xpoz/react/helpers/variable.context';

export const useFireEvents = () => {
  const { billingEnabled } = useVariables();

  return useCallback(
    (name: string, props?: any) => {
      if (!billingEnabled) {
        return;
      }
      // Analytics removed for XPoz — no external tracking
      console.debug('[XPoz Event]', name, props);
    },
    []
  );
};
