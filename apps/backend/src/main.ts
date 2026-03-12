import { initializeSentry } from '@xpoz/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('backend', true);
import compression from 'compression';

import { loadSwagger } from '@xpoz/helpers/swagger/load.swagger';
import { json } from 'express';
import { Runtime } from '@temporalio/worker';
Runtime.install({ shutdownSignals: [] });

process.env.TZ = 'UTC';

// Configure global proxy for ALL outbound requests (fetch, axios, etc.)
// Respects NO_PROXY for local services (Redis, PostgreSQL, localhost)
const _proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (_proxyUrl) {
  try {
    // 1. Global fetch() proxy (undici) — covers fetch() calls like uploadSimple
    const { EnvHttpProxyAgent, setGlobalDispatcher } = require('undici');
    setGlobalDispatcher(new EnvHttpProxyAgent());

    // 2. Global axios proxy — covers axios calls like readOrFetch (media downloads)
    const { HttpsProxyAgent: _HttpsProxyAgent } = require('https-proxy-agent');
    const axios = require('axios');
    const _agent = new _HttpsProxyAgent(_proxyUrl);
    axios.defaults.httpAgent = _agent;
    axios.defaults.httpsAgent = _agent;

    console.log(`[Proxy] All outbound requests proxied via: ${_proxyUrl}`);
    console.log(`[Proxy] NO_PROXY: ${process.env.NO_PROXY || '(not set)'}`);
  } catch (e) {
    console.warn(`[Proxy] Failed to configure proxy: ${e}`);
  }
}

import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { SubscriptionExceptionFilter } from '@xpoz/backend/services/auth/permissions/subscription.exception';
import { HttpExceptionFilter } from '@xpoz/nestjs-libraries/services/exception.filter';
import { ConfigurationChecker } from '@xpoz/helpers/configuration/configuration.checker';
import { startMcp } from '@xpoz/nestjs-libraries/chat/start.mcp';

async function start() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    cors: {
      ...(!process.env.NOT_SECURED ? { credentials: true } : {}),
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-copilotkit-runtime-client-gql-version',
        ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
      ],
      exposedHeaders: [
        'reload',
        'onboarding',
        'activate',
        'x-copilotkit-runtime-client-gql-version',
        ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
      ],
      origin: [
        process.env.FRONTEND_URL,
        'http://localhost:6274',
        ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
      ],
    },
  });

  await startMcp(app);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.use(['/copilot/*', '/posts'], (req: any, res: any, next: any) => {
    json({ limit: '50mb' })(req, res, next);
  });

  app.use(cookieParser());
  app.use(compression());
  app.useGlobalFilters(new SubscriptionExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  loadSwagger(app);

  const port = process.env.PORT || 3000;

  try {
    await app.listen(port);

    checkConfiguration(); // Do this last, so that users will see obvious issues at the end of the startup log without having to scroll up.

    Logger.log(`🚀 Backend is running on: http://localhost:${port}`);
  } catch (e) {
    Logger.error(`Backend failed to start on port ${port}`, e);
  }
}

function checkConfiguration() {
  const checker = new ConfigurationChecker();
  checker.readEnvFromProcess();
  checker.check();

  if (checker.hasIssues()) {
    for (const issue of checker.getIssues()) {
      Logger.warn(issue, 'Configuration issue');
    }

    Logger.warn('Configuration issues found: ' + checker.getIssuesCount());
  } else {
    Logger.log('Configuration check completed without any issues');
  }
}

start();
