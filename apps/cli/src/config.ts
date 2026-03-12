import { XPozConfig } from './api';

export function getConfig(): XPozConfig {
  const apiKey = process.env.XPOZ_API_KEY;
  const apiUrl = process.env.XPOZ_API_URL;

  if (!apiKey) {
    console.error('❌ Error: XPOZ_API_KEY environment variable is required');
    console.error('Please set it using: export XPOZ_API_KEY=your_api_key');
    process.exit(1);
  }

  return {
    apiKey,
    apiUrl,
  };
}
