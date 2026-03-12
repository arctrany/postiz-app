/**
 * A2A Controller — XPoz ↔ Openclaw 对等互通
 *
 * MVP 安全模型：双向 API Key（x-a2a-key Header）
 * - Openclaw 发给 XPoz 时携带 process.env.OPENCLAW_A2A_KEY
 * - XPoz 发给 Openclaw 时携带 process.env.XPOZ_A2A_KEY
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

interface A2ATask {
  skill_id: 'publish' | 'schedule' | 'list_channels';
  input: {
    content?: string;
    platforms?: string[];
    publishAt?: string; // ISO datetime for scheduled posts
    title?: string;
  };
}

@Controller('/a2a')
export class A2AController {
  /**
   * AgentCard — 供 Openclaw 发现 XPoz 的能力声明（公开端点，无需认证）
   */
  @Get('/agent-card')
  agentCard() {
    return {
      name: 'XPoz',
      version: '1.0',
      description:
        '全媒体内容发布 Agent，支持 55+ 国内外社交平台，含定时调度能力',
      url: (process.env.BACKEND_URL || '') + '/a2a',
      skills: [
        {
          id: 'list_channels',
          description: '列出用户已连接的所有发布渠道及状态',
        },
        {
          id: 'publish',
          description: '立即将内容发布到指定社交平台列表',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: '文章正文（Markdown）' },
              title: { type: 'string', description: '文章标题（可选）' },
              platforms: {
                type: 'array',
                items: { type: 'string' },
                description: '目标平台 ID 列表，如 ["x", "zhihu"]',
              },
            },
            required: ['content', 'platforms'],
          },
        },
        {
          id: 'schedule',
          description: '在指定时间发布内容到平台列表',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              title: { type: 'string' },
              platforms: { type: 'array', items: { type: 'string' } },
              publishAt: {
                type: 'string',
                format: 'date-time',
                description: '计划发布时间（ISO 8601）',
              },
            },
            required: ['content', 'platforms', 'publishAt'],
          },
        },
      ],
    };
  }

  /**
   * 接收来自 Openclaw 的 A2A 任务
   */
  @Post('/tasks')
  async receiveTask(
    @Body() task: A2ATask,
    @Headers('x-a2a-key') apiKey: string
  ) {
    // 验证来源 API Key
    const expectedKey = process.env.OPENCLAW_A2A_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid A2A API key');
    }

    switch (task.skill_id) {
      case 'list_channels': {
        // TODO: 接入 IntegrationsService，通过 org_id 返回渠道列表
        return {
          success: true,
          skill_id: 'list_channels',
          channels: [],
          message: 'list_channels requires user org context — pass org_id in future versions',
        };
      }

      case 'publish': {
        if (!task.input.content || !task.input.platforms?.length) {
          throw new BadRequestException('publish requires content and platforms');
        }
        // TODO: 接入 PostsService.publishNow()
        return {
          success: true,
          skill_id: 'publish',
          message: 'publish task queued',
          input: task.input,
        };
      }

      case 'schedule': {
        if (
          !task.input.content ||
          !task.input.platforms?.length ||
          !task.input.publishAt
        ) {
          throw new BadRequestException(
            'schedule requires content, platforms, and publishAt'
          );
        }
        // TODO: 接入 Temporal 调度器
        return {
          success: true,
          skill_id: 'schedule',
          message: 'schedule task queued',
          input: task.input,
        };
      }

      default: {
        throw new BadRequestException(
          `Unknown skill_id: "${(task as any).skill_id}". Supported: publish, schedule, list_channels`
        );
      }
    }
  }

  /**
   * XPoz 主动调用 Openclaw（静态工具方法，供 Copilot 工具使用）
   */
  static async callOpenclaw(
    skillId: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const url = process.env.OPENCLAW_A2A_URL;
    if (!url) return null;

    const res = await fetch(`${url}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-a2a-key': process.env.XPOZ_A2A_KEY || '',
      },
      body: JSON.stringify({ skill_id: skillId, input }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Openclaw A2A call failed: ${res.status} ${text}`);
    }

    return res.json();
  }
}
