import fetch, { FormData } from 'node-fetch';

export interface XPozConfig {
  apiKey: string;
  apiUrl?: string;
}

export class XPozAPI {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: XPozConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.xpoz.com';
  }

  private async request(endpoint: string, options: any = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: this.apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async createPost(data: any) {
    return this.request('/public/v1/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listPosts(filters: any = {}) {
    const queryString = new URLSearchParams(
      Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    const endpoint = queryString
      ? `/public/v1/posts?${queryString}`
      : '/public/v1/posts';

    return this.request(endpoint, {
      method: 'GET',
    });
  }

  async deletePost(id: string) {
    return this.request(`/public/v1/posts/${id}`, {
      method: 'DELETE',
    });
  }

  async upload(file: Buffer, filename: string) {
    const formData = new FormData();
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    // Determine MIME type based on file extension
    const mimeTypes: Record<string, string> = {
      // Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon',

      // Videos
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'webm': 'video/webm',
      'flv': 'video/x-flv',
      'wmv': 'video/x-ms-wmv',
      'm4v': 'video/x-m4v',
      'mpeg': 'video/mpeg',
      'mpg': 'video/mpeg',
      '3gp': 'video/3gpp',

      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'm4a': 'audio/mp4',

      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const type = mimeTypes[extension] || 'application/octet-stream';

    const blob = new Blob([file], { type });
    formData.append('file', blob, filename);

    const url = `${this.apiUrl}/public/v1/upload`;
    const response = await fetch(url, {
      method: 'POST',
      // @ts-ignore
      body: formData,
      headers: {
        Authorization: this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed (${response.status}): ${error}`);
    }

    return await response.json();
  }

  async listIntegrations() {
    return this.request('/public/v1/integrations', {
      method: 'GET',
    });
  }

  async getIntegrationSettings(integrationId: string) {
    return this.request(`/public/v1/integration-settings/${integrationId}`, {
      method: 'GET',
    });
  }

  async triggerIntegrationTool(
    integrationId: string,
    methodName: string,
    data: Record<string, string>
  ) {
    return this.request(`/public/v1/integration-trigger/${integrationId}`, {
      method: 'POST',
      body: JSON.stringify({ methodName, data }),
    });
  }

  async getAnalytics(integrationId: string, date?: string) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/public/v1/analytics/${integrationId}${query}`, {
      method: 'GET',
    });
  }

  async getPostAnalytics(postId: string, date?: number) {
    const query = date !== undefined ? `?date=${date}` : '';
    return this.request(`/public/v1/analytics/post/${postId}${query}`, {
      method: 'GET',
    });
  }

  async getNotifications(page: number = 0) {
    return this.request(`/public/v1/notifications?page=${page}`, {
      method: 'GET',
    });
  }

  async getChannelAuthUrl(integration: string, refresh?: string) {
    const query = refresh ? `?refresh=${encodeURIComponent(refresh)}` : '';
    return this.request(`/public/v1/social/${integration}${query}`, {
      method: 'GET',
    });
  }

  async deleteChannel(id: string) {
    return this.request(`/public/v1/integrations/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadFromUrl(url: string) {
    return this.request('/public/v1/upload-from-url', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async findSlot(integrationId?: string) {
    const path = integrationId
      ? `/public/v1/find-slot/${integrationId}`
      : '/public/v1/find-slot/all';
    return this.request(path, {
      method: 'GET',
    });
  }

  async checkConnection() {
    return this.request('/public/v1/is-connected', {
      method: 'GET',
    });
  }
}
