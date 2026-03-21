import { XPozAPI } from '../api';
import { getConfig } from '../config';

export async function listNotifications(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  const page = args.page || 0;

  try {
    const result = await api.getNotifications(page);
    console.log(`🔔 Notifications (page ${page}):`);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get notifications:', error.message);
    process.exit(1);
  }
}
