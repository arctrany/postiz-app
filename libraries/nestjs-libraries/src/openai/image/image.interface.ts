/**
 * Image Generation Provider Interface
 *
 * All image generation providers must implement this interface.
 * This abstraction allows switching between OpenAI DALL-E, Fal.ai,
 * and any other image generation service via the IMAGE_PROVIDER env var.
 */
export interface IImageProvider {
  /**
   * Generate an image from a text prompt.
   *
   * @param prompt - The text prompt describing the desired image
   * @param options - Generation options
   * @returns URL of the generated image, or base64-encoded image data
   */
  generateImage(
    prompt: string,
    options?: ImageGenerationOptions
  ): Promise<string>;

  /**
   * Check if this provider is properly configured and available.
   */
  isAvailable(): boolean;

  /**
   * Get the provider identifier name.
   */
  readonly name: string;
}

export interface ImageGenerationOptions {
  /**
   * Whether to return a URL (true) or base64 data (false).
   * Default: false (base64)
   */
  returnUrl?: boolean;

  /**
   * Whether to generate a vertical (portrait) image.
   * Default: false (landscape/square)
   */
  isVertical?: boolean;

  /**
   * Override the model for this specific generation.
   */
  model?: string;
}
