import { Injectable } from '@nestjs/common';
import { IImageProvider, ImageGenerationOptions } from './image.interface';
import { ImageFactory } from './image.factory';

/**
 * NestJS injectable service for image generation.
 *
 * Wraps the ImageFactory to provide dependency-injectable image generation.
 * This replaces direct calls to OpenaiService.generateImage() and
 * FalService.generateImageFromText().
 */
@Injectable()
export class ImageGenerationService {
  private provider: IImageProvider;

  constructor() {
    this.provider = ImageFactory.createProvider();
  }

  /**
   * Generate an image from a text prompt.
   *
   * @param prompt - The text prompt
   * @param returnUrl - Whether to return URL (true) or base64 (false)
   * @param isVertical - Whether to generate a vertical/portrait image
   * @returns URL or base64 data of the generated image
   */
  async generateImage(
    prompt: string,
    returnUrl = false,
    isVertical = false
  ): Promise<string> {
    return this.provider.generateImage(prompt, {
      returnUrl,
      isVertical,
    });
  }

  /**
   * Generate an image using a specific model override.
   * Used by video slides and other components that need specific models.
   *
   * @param model - The model to use (e.g., 'ideogram/v2' for fal.ai)
   * @param prompt - The text prompt
   * @param isVertical - Whether to generate a vertical image
   * @returns URL of the generated image
   */
  async generateImageWithModel(
    model: string,
    prompt: string,
    isVertical = false
  ): Promise<string> {
    return this.provider.generateImage(prompt, {
      returnUrl: true,
      isVertical,
      model,
    });
  }

  /**
   * Get the name of the active image provider.
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Check if the image provider is properly configured.
   */
  isAvailable(): boolean {
    return this.provider.isAvailable();
  }
}
