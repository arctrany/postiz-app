// ---- Request Types ----

export interface PingRequest {
  type: 'PING';
}

export interface GetProvidersRequest {
  type: 'GET_PROVIDERS';
}

export interface GetCookiesRequest {
  type: 'GET_COOKIES';
  provider: string;
}

export interface StoreRefreshTokenRequest {
  type: 'STORE_REFRESH_TOKEN';
  provider: string;
  integrationId: string;
  jwt: string;
  backendUrl: string;
}

export interface RemoveRefreshTokenRequest {
  type: 'REMOVE_REFRESH_TOKEN';
  integrationId: string;
}

// ---- Wechatsync Request Types ----

export interface WechatsyncGetPlatformsRequest {
  type: 'WECHATSYNC_GET_PLATFORMS';
}

export interface WechatsyncCheckAuthRequest {
  type: 'WECHATSYNC_CHECK_AUTH';
  platformId: string;
}

export interface WechatsyncPublishRequest {
  type: 'WECHATSYNC_PUBLISH';
  platformId: string;
  article: {
    title: string;
    markdown: string;
    html?: string;
    summary?: string;
    cover?: string;
    tags?: string[];
    category?: string;
  };
  options?: {
    draftOnly?: boolean;
  };
}

export type ExtensionRequest =
  | PingRequest
  | GetProvidersRequest
  | GetCookiesRequest
  | StoreRefreshTokenRequest
  | RemoveRefreshTokenRequest
  | WechatsyncGetPlatformsRequest
  | WechatsyncCheckAuthRequest
  | WechatsyncPublishRequest;

// ---- Response Types ----

export interface PingResponse {
  status: 'ok';
  version: string;
}

export interface ProviderInfo {
  identifier: string;
  name: string;
  url: string;
  cookieNames: string[];
}

export interface GetProvidersResponse {
  providers: ProviderInfo[];
}

export interface GetCookiesSuccessResponse {
  success: true;
  provider: string;
  cookies: Record<string, string>;
}

export interface GetCookiesErrorResponse {
  success: false;
  provider: string;
  error: string;
  missingCookies?: string[];
}

export type GetCookiesResponse =
  | GetCookiesSuccessResponse
  | GetCookiesErrorResponse;

export interface StoredRefreshEntry {
  jwt: string;
  backendUrl: string;
  provider: string;
}

// ---- Wechatsync Response Types ----

export interface WechatsyncPlatformInfo {
  id: string;
  name: string;
  icon: string;
  homepage: string;
  capabilities: string[];
}

export interface WechatsyncGetPlatformsResponse {
  platforms: WechatsyncPlatformInfo[];
}

export interface WechatsyncAuthResponse {
  platformId: string;
  isAuthenticated: boolean;
  username?: string;
  userId?: string;
  avatar?: string;
  error?: string;
}

export interface WechatsyncPublishResponse {
  platformId: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  draftOnly?: boolean;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
}

export type ExtensionResponse =
  | PingResponse
  | GetProvidersResponse
  | GetCookiesResponse
  | WechatsyncGetPlatformsResponse
  | WechatsyncAuthResponse
  | WechatsyncPublishResponse
  | ErrorResponse;

