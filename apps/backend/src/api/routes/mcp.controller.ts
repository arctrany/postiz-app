/**
 * MCP Controller — XPoz Universal AI Bridge
 *
 * 暴露以下工具供所有 MCP 兼容的 AI 客户端使用：
 *   list_platforms  → 列出已连接的平台及状态
 *   check_auth      → 检查单个平台的认证状态
 *   sync_article    → 立即发布文章到指定平台
 *   schedule_post   → 定时发布文章
 *
 * 传输协议（MVP）：HTTP POST，复用现有 AuthMiddleware JWT 认证
 *   GET  /mcp/manifest            → 工具清单（工具发现）
 *   POST /mcp/tools/:toolName     → 调用指定工具
 *
 * 集成方式：在 api.module.ts 的 authenticatedController 列表中注册，
 * AuthMiddleware 自动处理 JWT 认证与 org/user 注入。
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { IntegrationService } from '@xpoz/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@xpoz/nestjs-libraries/database/prisma/posts/posts.service';
import { GetOrgFromRequest } from '@xpoz/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

// ── Tool Manifest ──────────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'list_platforms',
    description: '列出当前用户已连接的所有社交平台及其状态',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_auth',
    description: '检查指定平台 Integration 的认证状态',
    inputSchema: {
      type: 'object',
      properties: {
        integrationId: { type: 'string', description: '平台 Integration ID' },
      },
      required: ['integrationId'],
    },
  },
  {
    name: 'sync_article',
    description: '立即将文章发布到指定平台列表',
    inputSchema: {
      type: 'object',
      properties: {
        content:   { type: 'string',  description: '文章正文（Markdown）' },
        title:     { type: 'string',  description: '文章标题（可选）' },
        platforms: { type: 'array',   items: { type: 'string' }, description: '目标平台 ID 列表，如 ["x", "xsync-zhihu"]' },
        images:    { type: 'array',   items: { type: 'string' }, description: '图片 URL 列表（可选）' },
      },
      required: ['content', 'platforms'],
    },
  },
  {
    name: 'schedule_post',
    description: '在指定时间发布文章到平台列表',
    inputSchema: {
      type: 'object',
      properties: {
        content:   { type: 'string', description: '文章正文（Markdown）' },
        title:     { type: 'string', description: '文章标题（可选）' },
        platforms: { type: 'array',  items: { type: 'string' } },
        publishAt: { type: 'string', format: 'date-time', description: '计划发布时间（ISO 8601）' },
        images:    { type: 'array',  items: { type: 'string' } },
      },
      required: ['content', 'platforms', 'publishAt'],
    },
  },
];

// ── Public Controller (no auth) ───────────────────────────────────────

@ApiTags('MCP')
@Controller('/mcp')
export class McpPublicController {
  /** 工具清单（公开，无需认证）— Claude Desktop / MCP Inspector 用 */
  @Get('/manifest')
  manifest() {
    return {
      schema_version: '0.1',
      name:           'XPoz',
      description:    '全媒体内容发布平台，支持 55+ 国内外社交媒体',
      tools:          MCP_TOOLS,
    };
  }
}

// ── Authenticated Controller ──────────────────────────────────────────

@ApiTags('MCP')
@Controller('/mcp')
export class McpController {
  constructor(
    private readonly _integrationService: IntegrationService,
    private readonly _postsService: PostsService,
  ) {}

  // ── Tool Router ───────────────────────────────────────────────────────

  @Post('/tools/:toolName')
  async callTool(
    @Param('toolName') toolName: string,
    @Body() input: Record<string, unknown>,
    @GetOrgFromRequest() org: Organization,
  ) {
    const tool = MCP_TOOLS.find((t) => t.name === toolName);
    if (!tool) {
      throw new NotFoundException(
        `Unknown tool: "${toolName}". Available: ${MCP_TOOLS.map((t) => t.name).join(', ')}`,
      );
    }

    switch (toolName) {
      case 'list_platforms': return this.toolListPlatforms(org.id);
      case 'check_auth':     return this.toolCheckAuth(org.id, input);
      case 'sync_article':   return this.toolSyncArticle(org.id, input);
      case 'schedule_post':  return this.toolSchedulePost(org.id, input);
      default:
        throw new BadRequestException(`Tool "${toolName}" not implemented`);
    }
  }

  // ── Tool Implementations ──────────────────────────────────────────────

  private async toolListPlatforms(orgId: string) {
    const integrations = await this._integrationService.getIntegrationsList(orgId);
    return {
      success:   true,
      platforms: integrations.map((i) => ({
        id:          i.id,
        name:        i.name,
        platform:    i.providerIdentifier,
        picture:     i.picture,
        disabled:    i.disabled,
        needsRefresh: i.refreshNeeded,
      })),
    };
  }

  private async toolCheckAuth(orgId: string, input: Record<string, unknown>) {
    const { integrationId } = input;
    if (!integrationId || typeof integrationId !== 'string') {
      throw new BadRequestException('integrationId is required');
    }

    const integration = await this._integrationService.getIntegrationById(orgId, integrationId);
    if (!integration) {
      throw new NotFoundException(`Integration "${integrationId}" not found`);
    }

    return {
      success:       true,
      integrationId: integration.id,
      platform:      integration.providerIdentifier,
      name:          integration.name,
      disabled:      integration.disabled,
      needsRefresh:  integration.refreshNeeded,
    };
  }

  private async toolSyncArticle(orgId: string, input: Record<string, unknown>) {
    const { content, title, platforms, images } = input as {
      content: string; title?: string; platforms: string[]; images?: string[];
    };

    if (!content || !platforms?.length) {
      throw new BadRequestException('sync_article requires content and platforms');
    }

    const allIntegrations = await this._integrationService.getIntegrationsList(orgId);
    const matched = allIntegrations.filter((i: any) => platforms.includes(i.providerIdentifier));

    if (!matched.length) {
      throw new BadRequestException(
        `No connected integrations for platforms: ${platforms.join(', ')}`,
      );
    }

    const postGroup = `mcp-${Date.now()}`;
    const now = new Date().toISOString();

    // 构造与 UI POST /posts/ 相同格式的 CreatePostDto，再经 mapTypeToPost 规范化
    const rawBody = {
      type:      'now',
      date:      now,
      shortLink: false,
      tags:      [] as { value: string; label: string }[],
      posts:     matched.map((integration: any) => ({
        integration: { id: integration.id },
        group:       postGroup,
        value:       [{ content, image: (images || []).map((url: string) => ({ path: url, pathArr: [] as never[] })) }],
        settings:    { title: title || '' },
      })),
    };

    const body = await this._postsService.mapTypeToPost(rawBody as any, orgId);
    await this._postsService.createPost(orgId, body);

    return {
      success:   true,
      message:   `Article queued for immediate publish on ${matched.length} platform(s)`,
      platforms: matched.map((i: any) => i.providerIdentifier),
      postGroup,
    };
  }

  private async toolSchedulePost(orgId: string, input: Record<string, unknown>) {
    const { content, title, platforms, publishAt, images } = input as {
      content: string; title?: string; platforms: string[]; publishAt: string; images?: string[];
    };

    if (!content || !platforms?.length || !publishAt) {
      throw new BadRequestException('schedule_post requires content, platforms, and publishAt');
    }

    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime()) || publishDate <= new Date()) {
      throw new BadRequestException('publishAt must be a valid future datetime (ISO 8601)');
    }

    const allIntegrations = await this._integrationService.getIntegrationsList(orgId);
    const matched = allIntegrations.filter((i: any) => platforms.includes(i.providerIdentifier));

    if (!matched.length) {
      throw new BadRequestException(
        `No connected integrations for platforms: ${platforms.join(', ')}`,
      );
    }

    const postGroup = `mcp-sched-${Date.now()}`;

    // 构造与 UI POST /posts/ 相同格式的 CreatePostDto，再经 mapTypeToPost 规范化
    const rawBody = {
      type:      'schedule',
      date:      publishDate.toISOString(),
      shortLink: false,
      tags:      [] as { value: string; label: string }[],
      posts:     matched.map((integration: any) => ({
        integration: { id: integration.id },
        group:       postGroup,
        value:       [{ content, image: (images || []).map((url: string) => ({ path: url, pathArr: [] as never[] })) }],
        settings:    { title: title || '' },
      })),
    };

    const body = await this._postsService.mapTypeToPost(rawBody as any, orgId);
    await this._postsService.createPost(orgId, body);

    return {
      success:   true,
      message:   `Post scheduled for ${publishDate.toISOString()} on ${matched.length} platform(s)`,
      platforms: matched.map((i: any) => i.providerIdentifier),
      publishAt: publishDate.toISOString(),
      postGroup,
    };
  }
}
