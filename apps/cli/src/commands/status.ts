import { XPozAPI } from '../api';
import { getConfig } from '../config';

export async function showStatus() {
  const config = getConfig();
  const api = new XPozAPI(config);

  try {
    const connection = await api.checkConnection();
    const integrations = await api.listIntegrations();
    const channels = Array.isArray(integrations) ? integrations : [];

    console.log('🟢 XPoz Status');
    console.log('─'.repeat(40));
    console.log(`   API URL:     ${config.apiUrl || 'https://api.xpoz.com'}`);
    console.log(`   Connected:   ${connection.connected ? 'Yes ✅' : 'No ❌'}`);
    console.log(`   Channels:    ${channels.length}`);

    if (channels.length > 0) {
      console.log('');
      console.log('   Connected Channels:');
      for (const ch of channels) {
        const status = ch.disabled ? '⛔' : '✅';
        const customer = ch.customer ? ` (${ch.customer.name})` : '';
        console.log(`     ${status} ${ch.name} [${ch.identifier}]${customer}`);
      }
    }

    console.log('─'.repeat(40));
    return { connection, channels };
  } catch (error: any) {
    console.error('🔴 XPoz Status: Disconnected');
    console.error('   Error:', error.message);
    process.exit(1);
  }
}
