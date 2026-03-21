import { XPozAPI } from '../api';
import { getConfig } from '../config';

export async function channelAnalytics(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.id) {
    console.error('❌ Integration/channel ID is required');
    process.exit(1);
  }

  try {
    const result = await api.getAnalytics(args.id, args.date);
    console.log(`📊 Analytics for channel: ${args.id}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get analytics:', error.message);
    process.exit(1);
  }
}

export async function postAnalytics(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.id) {
    console.error('❌ Post ID is required');
    process.exit(1);
  }

  // Convert date string to days-back number if provided
  let date: number | undefined;
  if (args.date) {
    const target = new Date(args.date);
    const now = new Date();
    date = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  }

  try {
    const result = await api.getPostAnalytics(args.id, date);
    console.log(`📈 Analytics for post: ${args.id}`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get post analytics:', error.message);
    process.exit(1);
  }
}
