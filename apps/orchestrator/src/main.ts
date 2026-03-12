import 'source-map-support/register';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '@xpoz/orchestrator/app.module';
import * as dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

// --- Global proxy configuration (same as backend) ---
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  // undici: proxy for global fetch()
  process.env.NO_PROXY = process.env.NO_PROXY || 'localhost,127.0.0.1,::1';
  setGlobalDispatcher(new EnvHttpProxyAgent());

  // axios: proxy for readOrFetch() and other axios calls
  const agent = new HttpsProxyAgent(proxyUrl);
  axios.defaults.httpAgent = agent;
  axios.defaults.httpsAgent = agent;
  axios.defaults.proxy = false; // let agent handle it

  console.log('[Orchestrator] Proxy configured:', proxyUrl);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
}

bootstrap();
