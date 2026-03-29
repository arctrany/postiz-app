import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import 'multer';
import { makeId } from '@xpoz/nestjs-libraries/services/make.is';
import mime from 'mime-types';
// @ts-ignore
import { getExtension } from 'mime';
import { IUploadProvider } from './upload.interface';

export class AliyunOSSStorage implements IUploadProvider {
  private _client: S3Client;
  private _publicUrl: string;

  constructor(
    endpoint: string,
    accessKeyId: string,
    accessKeySecret: string,
    private region: string,
    private _bucketName: string,
  ) {
    this._client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey: accessKeySecret,
      },
      forcePathStyle: false, // OSS uses virtual-hosted style URLs
    });

    // OSS public URL format: https://<bucket>.<endpoint-host>/<key>
    const ossHost = endpoint.replace('https://', '').replace('http://', '');
    this._publicUrl = `https://${_bucketName}.${ossHost}`;
  }

  async uploadSimple(path: string): Promise<string> {
    const loadImage = await fetch(path);
    const contentType =
      loadImage?.headers?.get('content-type') ||
      loadImage?.headers?.get('Content-Type');
    const extension = getExtension(contentType)!;
    const id = makeId(10);

    const command = new PutObjectCommand({
      Bucket: this._bucketName,
      Key: `${id}.${extension}`,
      Body: Buffer.from(await loadImage.arrayBuffer()),
      ContentType: contentType,
    });

    await this._client.send(command);
    return `${this._publicUrl}/${id}.${extension}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      const id = makeId(10);
      const extension = mime.extension(file.mimetype) || '';

      const command = new PutObjectCommand({
        Bucket: this._bucketName,
        Key: `${id}.${extension}`,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this._client.send(command);

      return {
        filename: `${id}.${extension}`,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        originalname: `${id}.${extension}`,
        fieldname: 'file',
        path: `${this._publicUrl}/${id}.${extension}`,
        destination: `${this._publicUrl}/${id}.${extension}`,
        encoding: '7bit',
        stream: file.buffer as any,
      };
    } catch (err) {
      console.error('Error uploading file to Alibaba Cloud OSS:', err);
      throw err;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    const fileName = filePath.split('/').pop();
    if (!fileName) return;

    const command = new DeleteObjectCommand({
      Bucket: this._bucketName,
      Key: fileName,
    });
    await this._client.send(command);
  }
}
