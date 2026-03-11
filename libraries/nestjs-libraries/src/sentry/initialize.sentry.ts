import * as Sentry from '@sentry/nestjs';
import { capitalize } from 'lodash';

let nodeProfilingIntegration: any = null;
try {
  nodeProfilingIntegration = require('@sentry/profiling-node').nodeProfilingIntegration;
} catch {
  // Native CPU profiler not available (e.g. unsupported Node version)
}

export const initializeSentry = (appName: string, allowLogs = false) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return null;
  }

  try {
    const integrations: any[] = [
      Sentry.consoleLoggingIntegration({ levels: ['log', 'info', 'warn', 'error', 'debug', 'assert', 'trace'] }),
      Sentry.openAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
    ];

    if (nodeProfilingIntegration) {
      integrations.unshift(nodeProfilingIntegration());
    }

    Sentry.init({
      initialScope: {
        tags: {
          service: appName,
          component: 'nestjs',
        },
        contexts: {
          app: {
            name: `XPoz ${capitalize(appName)}`,
          },
        },
      },
      environment: process.env.NODE_ENV || 'development',
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      spotlight: process.env.SENTRY_SPOTLIGHT === '1',
      integrations,
      tracesSampleRate: 1.0,
      enableLogs: true,

      // Profiling (only if available)
      ...(nodeProfilingIntegration ? {
        profileSessionSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.45,
        profileLifecycle: 'trace' as const,
      } : {}),
    });
  } catch (err) {
    console.log(err);
  }
  return true;
};
