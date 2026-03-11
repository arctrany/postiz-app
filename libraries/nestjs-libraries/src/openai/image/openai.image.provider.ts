import OpenAI from 'openai';
import {
  IImageProvider,
  ImageGenerationOptions,
} from './image.interface';

/**
 * OpenAI DALL-E image generation provider.
 *
 * Supports DALL-E 2, DALL-E 3, gpt-image-1, and any OpenAI-compatible
 * image generation API (e.g., Qwen Wanx via DashScope).
 */
export class OpenAIImageProvider implements IImageProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private defaultModel: string;

  constructor() {
    this.client = new OpenAI({
      apiKey:
        process.env.IMAGE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        'sk-proj-',
      ...(process.env.IMAGE_BASE_URL
        ? { baseURL: process.env.IMAGE_BASE_URL }
        : process.env.AI_BASE_URL
        ? { baseURL: process.env.AI_BASE_URL }
        : {}),
    });
    this.defaultModel = process.env.IMAGE_MODEL || 'dall-e-3';
  }

  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<string> {
    const { returnUrl = false, isVertical = false, model } = options;

    const generate = (
      await this.client.images.generate({
        prompt,
        response_format: returnUrl ? 'url' : 'b64_json',
        model: model || this.defaultModel,
        ...(isVertical ? { size: '1024x1792' as const } : {}),
      })
    ).data[0];

    return (returnUrl ? generate.url : generate.b64_json) as string;
  }

  isAvailable(): boolean {
    return !!(
      process.env.IMAGE_API_KEY ||
      process.env.OPENAI_API_KEY
    );
  }
}
