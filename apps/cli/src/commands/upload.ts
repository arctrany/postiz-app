import { XPozAPI } from '../api';
import { getConfig } from '../config';
import { readFileSync } from 'fs';
import { basename } from 'path';

export async function uploadFile(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.file) {
    console.error('❌ File path is required');
    process.exit(1);
  }

  try {
    const fileBuffer = readFileSync(args.file);
    const filename = basename(args.file);

    const result = await api.upload(fileBuffer, filename);
    console.log('✅ File uploaded successfully!');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error('❌ Failed to upload file:', error.message);
    process.exit(1);
  }
}

export async function uploadFromUrl(args: any) {
  const config = getConfig();
  const api = new XPozAPI(config);

  if (!args.url) {
    console.error('❌ URL is required');
    process.exit(1);
  }

  try {
    const result = await api.uploadFromUrl(args.url);
    console.log('✅ File uploaded from URL successfully!');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error: any) {
    console.error('❌ Failed to upload from URL:', error.message);
    process.exit(1);
  }
}
