import { CloudflareStorage } from './cloudflare.storage';
import { IUploadProvider } from './upload.interface';
import { LocalStorage } from './local.storage';
import { AliyunOSSStorage } from './aliyun-oss.storage';

export class UploadFactory {
  static createStorage(): IUploadProvider {
    const storageProvider = process.env.STORAGE_PROVIDER || 'local';

    switch (storageProvider) {
      case 'local':
        return new LocalStorage(process.env.UPLOAD_DIRECTORY!);
      case 'cloudflare':
        return new CloudflareStorage(
          process.env.CLOUDFLARE_ACCOUNT_ID!,
          process.env.CLOUDFLARE_ACCESS_KEY!,
          process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
          process.env.CLOUDFLARE_REGION!,
          process.env.CLOUDFLARE_BUCKETNAME!,
          process.env.CLOUDFLARE_BUCKET_URL!
        );
      case 'aliyun':
        return new AliyunOSSStorage(
          process.env.ALIBABA_OSS_ENDPOINT!,
          process.env.ALIBABA_OSS_ACCESS_KEY_ID!,
          process.env.ALIBABA_OSS_ACCESS_KEY_SECRET!,
          process.env.ALIBABA_OSS_REGION!,
          process.env.ALIBABA_OSS_BUCKET!,
        );
      default:
        throw new Error(`Invalid storage type ${storageProvider}`);
    }
  }
}
