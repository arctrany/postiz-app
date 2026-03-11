import { IImageProvider } from './image.interface';
import { OpenAIImageProvider } from './openai.image.provider';
import { FalImageProvider } from './fal.image.provider';

/**
 * Image Generation Provider Factory
 *
 * Similar to UploadFactory, this factory creates the appropriate
 * image generation provider based on the IMAGE_PROVIDER env var.
 *
 * Supported providers:
 *   - 'openai' (default): OpenAI DALL-E / any OpenAI-compatible image API
 *   - 'fal': Fal.ai (Flux, Stable Diffusion, Ideogram, etc.)
 *
 * Environment variables:
 *   - IMAGE_PROVIDER: 'openai' | 'fal' (default: 'openai')
 *   - IMAGE_API_KEY: API key for the image provider (falls back to OPENAI_API_KEY)
 *   - IMAGE_MODEL: Model name (default varies by provider)
 *   - IMAGE_BASE_URL: Custom endpoint for OpenAI-compatible providers
 *   - FAL_KEY: Required when IMAGE_PROVIDER='fal'
 */
export class ImageFactory {
  private static instance: IImageProvider | null = null;

  static createProvider(): IImageProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = (
      process.env.IMAGE_PROVIDER || 'openai'
    ).toLowerCase();

    switch (providerType) {
      case 'openai':
        this.instance = new OpenAIImageProvider();
        break;
      case 'fal':
        this.instance = new FalImageProvider();
        break;
      default:
        throw new Error(
          `Invalid IMAGE_PROVIDER: "${providerType}". ` +
            `Supported providers: openai, fal`
        );
    }

    return this.instance;
  }

  /**
   * Reset the cached instance. Useful for testing.
   */
  static reset(): void {
    this.instance = null;
  }
}
