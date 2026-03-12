import { TweetV2, TwitterApi } from 'twitter-api-v2';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { lookup } from 'mime-types';
import sharp from 'sharp';
import { readOrFetch } from '@gitroom/helpers/utils/read.or.fetch';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Plug } from '@gitroom/helpers/decorators/plug.decorator';
import { Integration } from '@prisma/client';
import { timer } from '@gitroom/helpers/utils/timer';
import { PostPlug } from '@gitroom/helpers/decorators/post.plug';
import dayjs from 'dayjs';
import { uniqBy } from 'lodash';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { XDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/x.dto';
import { Rules } from '@gitroom/nestjs-libraries/chat/rules.description.decorator';

// OAuth 2.0 scopes required for full functionality
// Ref: https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code
// Note: media upload uses OAuth 1.0a separately (v2 media upload requires it)
const OAUTH2_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',    // Required for refresh tokens
  'like.read',
  'like.write',
  'bookmark.read',
  'bookmark.write',
  'dm.read',
  'dm.write',
  'follows.read',
  'follows.write',
  'mute.read',
  'mute.write',
  'block.read',
  'block.write',
  'list.read',
  'list.write',
  'space.read',
];

@Rules(
  'X can have maximum 4 pictures, or maximum one video, it can also be without attachments'
)
export class XProvider extends SocialAbstract implements SocialProvider {
  identifier = 'x';
  name = 'X';
  isBetweenSteps = false;
  scopes = OAUTH2_SCOPES;
  override maxConcurrentJob = 1; // X has strict rate limits (300 posts per 3 hours)
  toolTip =
    'You will be logged in into your current account, if you would like a different account, change it first on X';

  editor = 'normal' as const;
  dto = XDto;

  // Support both old OAuth 1.0a env vars and new OAuth 2.0 env vars
  private get clientId(): string {
    return process.env.X_CLIENT_ID || process.env.X_API_KEY || '';
  }

  private get clientSecret(): string {
    return process.env.X_CLIENT_SECRET || process.env.X_API_SECRET || '';
  }

  private get proxyAgent() {
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    return proxy ? new HttpsProxyAgent(proxy) : undefined;
  }

  maxLength(isTwitterPremium: boolean) {
    return isTwitterPremium ? 4000 : 200;
  }

  override handleErrors(body: string):
    | {
        type: 'refresh-token' | 'bad-body';
        value: string;
      }
    | undefined {
    if (body.includes('Unsupported Authentication')) {
      return {
        type: 'refresh-token',
        value: 'X authentication has expired, please reconnect your account',
      };
    }

    if (body.includes('invalid_grant') || body.includes('token has been revoked')) {
      return {
        type: 'refresh-token',
        value: 'X OAuth 2.0 token has expired or been revoked, please reconnect your account',
      };
    }

    if (body.includes('usage-capped')) {
      return {
        type: 'bad-body',
        value: 'Posting failed - capped reached. Please try again later',
      };
    }
    if (body.includes('duplicate-rules')) {
      return {
        type: 'bad-body',
        value:
          'You have already posted this post, please wait before posting again',
      };
    }
    if (body.includes('The Tweet contains an invalid URL.')) {
      return {
        type: 'bad-body',
        value: 'The Tweet contains a URL that is not allowed on X',
      };
    }
    if (
      body.includes(
        'This user is not allowed to post a video longer than 2 minutes'
      )
    ) {
      return {
        type: 'bad-body',
        value:
          'The video you are trying to post is longer than 2 minutes, which is not allowed for this account',
      };
    }
    return undefined;
  }

  @Plug({
    identifier: 'x-autoRepostPost',
    title: 'Auto Repost Posts',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, repost it to increase engagement (1 week old posts)',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
    ],
  })
  async autoRepostPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string }
  ) {
    const client = await this.getClient(integration.token);

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);
      await client.v2.retweet(integration.internalId, id);
      return true;
    }

    return false;
  }

  @PostPlug({
    identifier: 'x-repost-post-users',
    title: 'Add Re-posters',
    description: 'Add accounts to repost your post',
    pickIntegration: ['x'],
    fields: [],
  })
  async repostPostUsers(
    integration: Integration,
    originalIntegration: Integration,
    postId: string,
    information: any
  ) {
    const client = await this.getClient(integration.token);

    const {
      data: { id },
    } = await client.v2.me();

    try {
      await client.v2.retweet(id, postId);
    } catch (err) {
      /** nothing **/
    }
  }

  @Plug({
    identifier: 'x-autoPlugPost',
    title: 'Auto plug post',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, add another post to it so you followers get a notification about your promotion',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
      {
        name: 'post',
        type: 'richtext',
        placeholder: 'Post to plug',
        description: 'Message content to plug',
        validation: /^[\s\S]{3,}$/g,
      },
    ],
  })
  async autoPlugPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string; post: string }
  ) {
    const client = await this.getClient(integration.token);

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);

      await client.v2.tweet({
        text: stripHtmlValidation('normal', fields.post, true),
        reply: { in_reply_to_tweet_id: id },
      });
      return true;
    }

    return false;
  }

  async refreshToken(refreshTokenValue: string): Promise<AuthTokenDetails> {
    if (!refreshTokenValue) {
      // Legacy OAuth 1.0a tokens don't support refresh
      return {
        id: '',
        name: '',
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
        picture: '',
        username: '',
      };
    }

    try {
      const agent = this.proxyAgent;
      const client = new TwitterApi({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }, {
        ...(agent ? { httpAgent: agent } : {}),
      });

      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        client: refreshedClient,
      } = await client.refreshOAuth2Token(refreshTokenValue);

      const refreshedMeClient = new TwitterApi(newAccessToken, {
        ...(agent ? { httpAgent: agent } : {}),
      });

      const {
        data: { username, profile_image_url, name, id },
      } = await refreshedMeClient.v2.me({
        'user.fields': [
          'username',
          'profile_image_url',
          'name',
        ],
      });

      return {
        id: String(id),
        name,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken || refreshTokenValue,
        expiresIn: expiresIn,
        picture: profile_image_url || '',
        username,
      };
    } catch (err) {
      console.error('X OAuth 2.0 token refresh failed:', err);
      return {
        id: '',
        name: '',
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
        picture: '',
        username: '',
      };
    }
  }

  async generateAuthUrl() {
    const agent = this.proxyAgent;
    const client = new TwitterApi({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    }, {
      ...(agent ? { httpAgent: agent } : {}),
    });

    const callbackUrl =
      (process.env.X_URL || process.env.FRONTEND_URL) +
      `/integrations/social/x`;

    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      callbackUrl,
      {
        scope: OAUTH2_SCOPES,
      }
    );

    return {
      url,
      codeVerifier,
      state,
    };
  }

  async authenticate(params: { code: string; codeVerifier: string }) {
    const { code, codeVerifier } = params;

    const callbackUrl =
      (process.env.X_URL || process.env.FRONTEND_URL) +
      `/integrations/social/x`;

    const agent = this.proxyAgent;
    const client = new TwitterApi({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    }, {
      ...(agent ? { httpAgent: agent } : {}),
    });

    try {
      const {
        accessToken,
        refreshToken,
        expiresIn,
        client: loggedClient,
      } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackUrl,
      });

      // Create a new client with proxy for user info lookup
      // (loggedClient from loginWithOAuth2 doesn't inherit proxy settings)
      const meClient = new TwitterApi(accessToken, {
        ...(agent ? { httpAgent: agent } : {}),
      });

      const {
        data: { username, verified, profile_image_url, name, id },
      } = await meClient.v2.me({
        'user.fields': [
          'username',
          'verified',
          'verified_type',
          'profile_image_url',
          'name',
        ],
      });

      return {
        id: String(id),
        accessToken,
        name,
        refreshToken: refreshToken || '',
        expiresIn: expiresIn,
        picture: profile_image_url || '',
        username,
        additionalSettings: [
          {
            title: 'Verified',
            description: 'Is this a verified user? (Premium)',
            type: 'checkbox' as const,
            value: verified,
          },
        ],
      };
    } catch (err: any) {
      console.error('[X-OAuth] Token exchange failed:', err?.message);
      throw err;
    }
  }

  /**
   * Get an authenticated Twitter client.
   * Supports both:
   * - OAuth 2.0 Bearer tokens (new format, single token string)
   * - Legacy OAuth 1.0a tokens (format: "accessToken:accessSecret")
   */
  private async getClient(accessToken: string) {
    // Check if this is a legacy OAuth 1.0a token (contains ':' separator)
    if (accessToken.includes(':') && !accessToken.startsWith('ey')) {
      const [accessTokenSplit, accessSecretSplit] = accessToken.split(':');
      const agent = this.proxyAgent;
      return new TwitterApi({
        appKey: process.env.X_API_KEY!,
        appSecret: process.env.X_API_SECRET!,
        accessToken: accessTokenSplit,
        accessSecret: accessSecretSplit,
      }, {
        ...(agent ? { httpAgent: agent } : {}),
      });
    }

    // OAuth 2.0 Bearer token
    const agent = this.proxyAgent;
    return new TwitterApi(accessToken, {
      ...(agent ? { httpAgent: agent } : {}),
    });
  }

  private async uploadMedia(
    client: TwitterApi,
    postDetails: PostDetails<any>[],
    accessToken: string
  ) {
    return (
      await Promise.all(
        postDetails.flatMap((p) =>
          p?.media?.flatMap(async (m) => {
            return {
              id: await this.runInConcurrent(
                async () => {
                  try {
                    console.log('[X-Upload] Downloading media from:', m.path);
                    const rawData = await readOrFetch(m.path);
                    console.log('[X-Upload] Downloaded, size:', rawData?.length || 0);

                    let buffer: Buffer;
                    const isVideo = m.path.indexOf('mp4') > -1;
                    if (isVideo) {
                      buffer = Buffer.from(rawData);
                    } else {
                      const mimeType = lookup(m.path) || '';
                      const isGif = mimeType === 'image/gif';
                      buffer = await sharp(rawData, { animated: isGif })
                        .resize({ width: 1000 })
                        .png()
                        .toBuffer();
                      console.log('[X-Upload] Processed image, size:', buffer.length);
                    }

                    const mediaType = lookup(m.path) || 'image/png';
                    console.log('[X-Upload] Uploading via v2 media API, type:', mediaType, 'size:', buffer.length);

                    // Use X API v2 media upload (chunked) - works with OAuth 2.0 Bearer tokens
                    const mediaId = await this.uploadMediaV2(
                      accessToken,
                      buffer,
                      mediaType,
                      isVideo ? 'tweet_video' : 'tweet_image'
                    );
                    console.log('[X-Upload] Upload SUCCESS, media_id:', mediaId);
                    return mediaId;
                  } catch (uploadErr: any) {
                    console.error('[X-Upload] FAILED:', uploadErr?.message);
                    console.error('[X-Upload] Error details:', JSON.stringify({
                      data: uploadErr?.data,
                      code: uploadErr?.code,
                      statusCode: uploadErr?.statusCode,
                      response: uploadErr?.response?.data,
                    }, null, 2));
                    throw uploadErr;
                  }
                },
                true
              ),
              postId: p.id,
            };
          })
        )
      )
    ).reduce((acc, val) => {
      if (!val?.id) {
        return acc;
      }

      acc[val.postId] = acc[val.postId] || [];
      acc[val.postId].push(val.id);

      return acc;
    }, {} as Record<string, string[]>);
  }

  /**
   * Generate OAuth 1.0a Authorization header for X API requests.
   * Required because v2 media upload needs OAuth 1.0a, not Bearer tokens.
   */
  private generateOAuth1Header(
    method: string,
    url: string,
    params: Record<string, string> = {}
  ): string {
    const crypto = require('crypto');
    const apiKey = process.env.X_API_KEY!;
    const apiSecret = process.env.X_API_SECRET!;
    const accessToken = process.env.X_ACCESS_TOKEN!;
    const accessSecret = process.env.X_ACCESS_TOKEN_SECRET!;

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: apiKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: '1.0',
    };

    // Combine OAuth params with request params for signature
    const allParams = { ...oauthParams, ...params };
    const paramString = Object.keys(allParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
      .join('&');

    const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    oauthParams['oauth_signature'] = signature;
    return (
      'OAuth ' +
      Object.keys(oauthParams)
        .sort()
        .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
        .join(', ')
    );
  }

  /**
   * Upload media to X API v2 with OAuth 1.0a authentication.
   *
   * v2 API format (from docs.x.com):
   * - Simple upload: POST /2/media/upload  {media, media_type, media_category}
   * - Chunked INIT: POST /2/media/upload/initialize
   * - Chunked APPEND: POST /2/media/upload/{id}/append
   * - Chunked FINALIZE: POST /2/media/upload/{id}/finalize
   * - Status: GET /2/media/upload?media_id={id}
   */
  private async uploadMediaV2(
    _accessToken: string,
    buffer: Buffer,
    mediaType: string,
    mediaCategory: string
  ): Promise<string> {
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      throw new Error(
        'Media upload requires OAuth 1.0a credentials. ' +
        'Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env'
      );
    }

    const BASE_URL = 'https://api.x.com/2/media/upload';
    const proxyEnv = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

    const doFetch = async (url: string, options: RequestInit) => {
      if (proxyEnv) {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        const agent = new HttpsProxyAgent(proxyEnv);
        return fetch(url, { ...options, agent } as any);
      }
      return fetch(url, options);
    };

    const isVideo = mediaType.startsWith('video/');
    const MAX_SIMPLE_SIZE = 5 * 1024 * 1024; // 5MB

    if (!isVideo && buffer.length < MAX_SIMPLE_SIZE) {
      // ── SIMPLE UPLOAD (images < 5MB) ──
      const auth = this.generateOAuth1Header('POST', BASE_URL);
      console.log('[X-Upload] Simple upload:', buffer.length, 'bytes,', mediaType);

      const res = await doFetch(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media: buffer.toString('base64'),
          media_type: mediaType,
          media_category: mediaCategory,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[X-Upload] Simple upload failed:', res.status, errText);
        throw new Error(`Media upload failed: ${res.status} ${errText}`);
      }

      const data = (await res.json()) as any;
      const mediaId = data?.data?.id || data?.id || data?.media_id_string;
      console.log('[X-Upload] Simple upload OK, media_id:', mediaId);
      return mediaId;
    }

    // ── CHUNKED UPLOAD (videos or large files) ──

    // INIT
    const initUrl = `${BASE_URL}/initialize`;
    const initAuth = this.generateOAuth1Header('POST', initUrl);
    console.log('[X-Upload] Chunked INIT:', buffer.length, 'bytes,', mediaType);

    const initRes = await doFetch(initUrl, {
      method: 'POST',
      headers: {
        Authorization: initAuth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        total_bytes: buffer.length,
        media_type: mediaType,
        media_category: mediaCategory,
      }),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      console.error('[X-Upload] INIT failed:', initRes.status, errText);
      throw new Error(`INIT failed: ${initRes.status} ${errText}`);
    }

    const initData = (await initRes.json()) as any;
    const mediaId = initData?.data?.id || initData?.id || initData?.media_id_string;
    console.log('[X-Upload] INIT OK, media_id:', mediaId);

    // APPEND (5MB chunks)
    const CHUNK_SIZE = 5 * 1024 * 1024;
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      const chunk = buffer.subarray(i, Math.min(i + CHUNK_SIZE, buffer.length));
      const segmentIndex = Math.floor(i / CHUNK_SIZE);
      const appendUrl = `${BASE_URL}/${mediaId}/append`;
      const appendAuth = this.generateOAuth1Header('POST', appendUrl);

      console.log('[X-Upload] APPEND segment', segmentIndex, ':', chunk.length, 'bytes');
      const appendRes = await doFetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: appendAuth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media: chunk.toString('base64'),
          segment_index: segmentIndex,
        }),
      });

      if (!appendRes.ok && appendRes.status !== 204) {
        const errText = await appendRes.text();
        console.error('[X-Upload] APPEND failed:', appendRes.status, errText);
        throw new Error(`APPEND failed: ${appendRes.status} ${errText}`);
      }
    }
    console.log('[X-Upload] APPEND complete');

    // FINALIZE
    const finalUrl = `${BASE_URL}/${mediaId}/finalize`;
    const finalAuth = this.generateOAuth1Header('POST', finalUrl);

    const finalRes = await doFetch(finalUrl, {
      method: 'POST',
      headers: {
        Authorization: finalAuth,
        'Content-Type': 'application/json',
      },
    });

    if (!finalRes.ok) {
      const errText = await finalRes.text();
      console.error('[X-Upload] FINALIZE failed:', finalRes.status, errText);
      throw new Error(`FINALIZE failed: ${finalRes.status} ${errText}`);
    }

    const finalData = (await finalRes.json()) as any;
    console.log('[X-Upload] FINALIZE OK:', JSON.stringify(finalData));

    // Handle async processing (videos)
    if (finalData.processing_info) {
      let state = finalData.processing_info.state;
      while (state === 'pending' || state === 'in_progress') {
        const waitSecs = finalData.processing_info.check_after_secs || 5;
        console.log('[X-Upload] Processing, wait', waitSecs, 's...');
        await new Promise((r) => setTimeout(r, waitSecs * 1000));
        const statusUrl = `${BASE_URL}?media_id=${mediaId}`;
        const statusAuth = this.generateOAuth1Header('GET', statusUrl);
        const statusRes = await doFetch(statusUrl, {
          method: 'GET',
          headers: { Authorization: statusAuth },
        });
        const statusData = (await statusRes.json()) as any;
        state = statusData.processing_info?.state;
        console.log('[X-Upload] Status:', state);
      }
      if (state === 'failed') {
        throw new Error('Media processing failed');
      }
    }

    return mediaId;
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      community?: string;
      who_can_reply_post:
        | 'everyone'
        | 'following'
        | 'mentionedUsers'
        | 'subscribers'
        | 'verified';
    }>[]
  ): Promise<PostResponse[]> {
    const client = await this.getClient(accessToken);
    const {
      data: { username },
    } = await this.runInConcurrent(async () =>
      client.v2.me({
        'user.fields': 'username',
      })
    );

    const [firstPost] = postDetails;

    // upload media for the first post
    const uploadAll = await this.uploadMedia(client, [firstPost], accessToken);

    const media_ids = (uploadAll[firstPost.id] || []).filter((f) => f);

    // @ts-ignore
    const { data }: { data: { id: string } } = await this.runInConcurrent(
      async () =>
        // @ts-ignore
        client.v2.tweet({
          ...(!firstPost?.settings?.who_can_reply_post ||
          firstPost?.settings?.who_can_reply_post === 'everyone'
            ? {}
            : {
                reply_settings: firstPost?.settings?.who_can_reply_post,
              }),
          ...(firstPost?.settings?.community
            ? {
                share_with_followers: true,
                community_id:
                  firstPost?.settings?.community?.split('/').pop() || '',
              }
            : {}),
          text: firstPost.message,
          ...(media_ids.length ? { media: { media_ids } } : {}),
        })
    );

    return [
      {
        postId: data.id,
        id: firstPost.id,
        releaseURL: `https://twitter.com/${username}/status/${data.id}`,
        status: 'posted',
      },
    ];
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
    }>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const client = await this.getClient(accessToken);
    const {
      data: { username },
    } = await this.runInConcurrent(async () =>
      client.v2.me({
        'user.fields': 'username',
      })
    );

    const [commentPost] = postDetails;

    // upload media for the comment
    const uploadAll = await this.uploadMedia(client, [commentPost], accessToken);

    const media_ids = (uploadAll[commentPost.id] || []).filter((f) => f);

    const replyToId = lastCommentId || postId;

    // @ts-ignore
    const { data }: { data: { id: string } } = await this.runInConcurrent(
      async () =>
        // @ts-ignore
        client.v2.tweet({
          text: commentPost.message,
          ...(media_ids.length ? { media: { media_ids } } : {}),
          reply: { in_reply_to_tweet_id: replyToId },
        })
    );

    return [
      {
        postId: data.id,
        id: commentPost.id,
        releaseURL: `https://twitter.com/${username}/status/${data.id}`,
        status: 'posted',
      },
    ];
  }

  private loadAllTweets = async (
    client: TwitterApi,
    id: string,
    until: string,
    since: string,
    token = ''
  ): Promise<TweetV2[]> => {
    const tweets = await client.v2.userTimeline(id, {
      'tweet.fields': ['id'],
      'user.fields': [],
      'poll.fields': [],
      'place.fields': [],
      'media.fields': [],
      exclude: ['replies', 'retweets'],
      start_time: since,
      end_time: until,
      max_results: 100,
      ...(token ? { pagination_token: token } : {}),
    });

    return [
      ...tweets.data.data,
      ...(tweets.data.data.length === 100
        ? await this.loadAllTweets(
            client,
            id,
            until,
            since,
            tweets.meta.next_token
          )
        : []),
    ];
  };

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    const until = dayjs().endOf('day');
    const since = dayjs().subtract(date > 100 ? 100 : date, 'day');

    const client = await this.getClient(accessToken);

    try {
      const tweets = uniqBy(
        await this.loadAllTweets(
          client,
          id,
          until.format('YYYY-MM-DDTHH:mm:ssZ'),
          since.format('YYYY-MM-DDTHH:mm:ssZ')
        ),
        (p) => p.id
      );

      if (tweets.length === 0) {
        return [];
      }

      const data = await client.v2.tweets(
        tweets.map((p) => p.id),
        {
          'tweet.fields': ['public_metrics'],
        }
      );

      const metrics = data.data.reduce(
        (all, current) => {
          all.impression_count =
            (all.impression_count || 0) +
            +current.public_metrics.impression_count;
          all.bookmark_count =
            (all.bookmark_count || 0) + +current.public_metrics.bookmark_count;
          all.like_count =
            (all.like_count || 0) + +current.public_metrics.like_count;
          all.quote_count =
            (all.quote_count || 0) + +current.public_metrics.quote_count;
          all.reply_count =
            (all.reply_count || 0) + +current.public_metrics.reply_count;
          all.retweet_count =
            (all.retweet_count || 0) + +current.public_metrics.retweet_count;

          return all;
        },
        {
          impression_count: 0,
          bookmark_count: 0,
          like_count: 0,
          quote_count: 0,
          reply_count: 0,
          retweet_count: 0,
        }
      );

      return Object.entries(metrics).map(([key, value]) => ({
        label: key.replace('_count', '').replace('_', ' ').toUpperCase(),
        percentageChange: 5,
        data: [
          {
            total: String(0),
            date: since.format('YYYY-MM-DD'),
          },
          {
            total: String(value),
            date: until.format('YYYY-MM-DD'),
          },
        ],
      }));
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    const today = dayjs().format('YYYY-MM-DD');

    const client = await this.getClient(accessToken);

    try {
      // Fetch the specific tweet with public metrics
      const tweet = await client.v2.singleTweet(postId, {
        'tweet.fields': ['public_metrics', 'created_at'],
      });

      if (!tweet?.data?.public_metrics) {
        return [];
      }

      const metrics = tweet.data.public_metrics;

      const result: AnalyticsData[] = [];

      if (metrics.impression_count !== undefined) {
        result.push({
          label: 'Impressions',
          percentageChange: 0,
          data: [{ total: String(metrics.impression_count), date: today }],
        });
      }

      if (metrics.like_count !== undefined) {
        result.push({
          label: 'Likes',
          percentageChange: 0,
          data: [{ total: String(metrics.like_count), date: today }],
        });
      }

      if (metrics.retweet_count !== undefined) {
        result.push({
          label: 'Retweets',
          percentageChange: 0,
          data: [{ total: String(metrics.retweet_count), date: today }],
        });
      }

      if (metrics.reply_count !== undefined) {
        result.push({
          label: 'Replies',
          percentageChange: 0,
          data: [{ total: String(metrics.reply_count), date: today }],
        });
      }

      if (metrics.quote_count !== undefined) {
        result.push({
          label: 'Quotes',
          percentageChange: 0,
          data: [{ total: String(metrics.quote_count), date: today }],
        });
      }

      if (metrics.bookmark_count !== undefined) {
        result.push({
          label: 'Bookmarks',
          percentageChange: 0,
          data: [{ total: String(metrics.bookmark_count), date: today }],
        });
      }

      return result;
    } catch (err) {
      console.log('Error fetching X post analytics:', err);
    }

    return [];
  }

  override async mention(token: string, d: { query: string }) {
    const client = await this.getClient(token);

    try {
      const data = await client.v2.userByUsername(d.query, {
        'user.fields': ['username', 'name', 'profile_image_url'],
      });

      if (!data?.data?.username) {
        return [];
      }

      return [
        {
          id: data.data.username,
          image: data.data.profile_image_url,
          label: data.data.name,
        },
      ];
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  mentionFormat(idOrHandle: string, name: string) {
    return `@${idOrHandle}`;
  }
}
