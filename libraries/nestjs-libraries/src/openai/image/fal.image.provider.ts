import pLimit from 'p-limit';
import {
  IImageProvider,
  ImageGenerationOptions,
} from './image.interface';

const limit = pLimit(10);

/**
 * Fal.ai image generation provider.
 *
 * Supports Flux, Stable Diffusion, Ideogram, and other models
 * available on the fal.ai platform.
 *
 * Required env: FAL_KEY
 * Optional env: IMAGE_MODEL (default: 'flux/schnell')
 */
export class FalImageProvider implements IImageProvider {
  readonly name = 'fal';
  private defaultModel: string;

  constructor() {
    this.defaultModel = process.env.IMAGE_MODEL || 'flux/schnell';
  }

  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<string> {
    const { isVertical = false, model } = options;
    const selectedModel = model || this.defaultModel;

    const response = await limit(() =>
      fetch(`https://fal.run/fal-ai/${selectedModel}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: isVertical ? '9:16' : '16:9',
          resolution: '720p',
          num_images: 1,
          output_format: 'jpeg',
          expand_prompt: true,
        }),
      })
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Fal.ai image generation failed: ${data.detail || JSON.stringify(data)}`
      );
    }

    // Fal.ai returns images array or video object
    if (data.images && data.images.length > 0) {
      return data.images[0].url as string;
    }
    if (data.video) {
      return data.video.url as string;
    }

    throw new Error('Fal.ai returned no images or video');
  }

  isAvailable(): boolean {
    return !!process.env.FAL_KEY;
  }
}
