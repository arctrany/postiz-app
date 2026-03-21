import { XPozAPI } from '../api';
import { getConfig } from '../config';

export async function connectChannel(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.provider) {
    console.error('❌ Provider name is required (e.g. x, linkedin, facebook, instagram, youtube, tiktok, reddit, etc.)');
    process.exit(1);
  }

  try {
    const result = await api.getChannelAuthUrl(args.provider, args.refresh);
    console.log('🔗 Open this URL in your browser to connect the channel:');
    console.log('');
    console.log(`   ${result.url}`);
    console.log('');
    console.log('After authorizing, the channel will appear in your integrations list.');
    return result;
  } catch (error: any) {
    console.error('❌ Failed to generate auth URL:', error.message);
    process.exit(1);
  }
}

export async function disconnectChannel(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.id) {
    console.error('❌ Channel/integration ID is required');
    console.error('Run "xpoz integrations:list" to see available channels');
    process.exit(1);
  }

  try {
    await api.deleteChannel(args.id);
    console.log(`✅ Channel ${args.id} disconnected successfully!`);
  } catch (error: any) {
    console.error('❌ Failed to disconnect channel:', error.message);
    process.exit(1);
  }
}
