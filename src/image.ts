/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, GenkitError, Message, Part, z } from 'genkit';
import { ModelAction, ModelReference, modelRef } from 'genkit/model';
import { model } from 'genkit/plugin';

import { toGenkitError } from './errors.js';

/**
 * Per-call configuration for Bedrock image models. Fields a model family
 * doesn't take are ignored for it.
 */
export const ImageGenerationConfigSchema = z
  .object({
    numberOfImages: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Titan, Nova Canvas and Stability SDXL.'),
    width: z.number().int().optional().describe('Titan, Nova Canvas and SDXL.'),
    height: z
      .number()
      .int()
      .optional()
      .describe('Titan, Nova Canvas and SDXL.'),
    aspectRatio: z
      .string()
      .optional()
      .describe("Stability SD3 and Stable Image, such as '16:9'."),
    seed: z.number().int().optional(),
    cfgScale: z.number().optional().describe('Titan, Nova Canvas and SDXL.'),
    quality: z
      .enum(['standard', 'premium'])
      .optional()
      .describe('Titan and Nova Canvas.'),
    negativePrompt: z
      .string()
      .optional()
      .describe('What the image should not contain.'),
    steps: z.number().int().optional().describe('Stability SDXL.'),
    stylePreset: z.string().optional().describe('Stability SDXL.'),
    imageGenerationConfig: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        'Titan and Nova Canvas: raw imageGenerationConfig fields, merged over the ones above.'
      ),
  })
  .passthrough()
  .describe(
    "Unknown fields are sent as-is to Stability models, for options the schema doesn't cover."
  );

export type ImageGenerationConfig = z.infer<typeof ImageGenerationConfigSchema>;

/** The request shape an image model family takes. */
export type ImageFamily = 'titan' | 'stability-sdxl' | 'stability';

/**
 * Picks the image request shape from the model ID, or undefined for a model
 * that isn't an image generator.
 */
export function imageFamily(modelId: string): ImageFamily | undefined {
  const id = modelId.replace(/^(us|eu|apac|jp|au|ca|global|us-gov)\./, '');
  if (
    id.startsWith('amazon.titan-image-generator') ||
    id.startsWith('amazon.nova-canvas')
  ) {
    return 'titan';
  }
  if (id.startsWith('stability.stable-diffusion-xl')) return 'stability-sdxl';
  if (
    id.startsWith('stability.sd3') ||
    id.startsWith('stability.stable-image')
  ) {
    return 'stability';
  }
  return undefined;
}

const IMAGE_SUPPORTS = {
  multiturn: false,
  tools: false,
  media: false,
  systemRole: false,
  output: ['media'],
};

function imageModelRef(
  id: string,
  label: string
): ModelReference<typeof ImageGenerationConfigSchema> {
  return modelRef({
    name: `aws-bedrock/${id}`,
    info: { label, versions: [id], supports: IMAGE_SUPPORTS },
    configSchema: ImageGenerationConfigSchema,
  });
}

export const amazonTitanImageGeneratorV2 = imageModelRef(
  'amazon.titan-image-generator-v2:0',
  'Amazon - Titan Image Generator V2'
);
export const amazonNovaCanvasV1 = imageModelRef(
  'amazon.nova-canvas-v1:0',
  'Amazon - Nova Canvas V1'
);
export const stabilitySd35LargeV1 = imageModelRef(
  'stability.sd3-5-large-v1:0',
  'Stability AI - Stable Diffusion 3.5 Large'
);
export const stabilityStableImageCoreV1 = imageModelRef(
  'stability.stable-image-core-v1:1',
  'Stability AI - Stable Image Core'
);
export const stabilityStableImageUltraV1 = imageModelRef(
  'stability.stable-image-ultra-v1:1',
  'Stability AI - Stable Image Ultra'
);

/** The image models the plugin registers, by Bedrock model ID. */
export const SUPPORTED_IMAGE_MODELS: Record<
  string,
  ModelReference<typeof ImageGenerationConfigSchema>
> = {
  'amazon.titan-image-generator-v2:0': amazonTitanImageGeneratorV2,
  'amazon.nova-canvas-v1:0': amazonNovaCanvasV1,
  'stability.sd3-5-large-v1:0': stabilitySd35LargeV1,
  'stability.stable-image-core-v1:1': stabilityStableImageCoreV1,
  'stability.stable-image-ultra-v1:1': stabilityStableImageUltraV1,
};

/** Fields of the typed schema; everything else is passed through. */
const KNOWN_FIELDS = new Set([
  ...Object.keys(ImageGenerationConfigSchema.shape),
  'version',
]);

function extraFields(config: ImageGenerationConfig): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([k]) => !KNOWN_FIELDS.has(k))
  );
}

/**
 * Builds the InvokeModel body for an image model.
 */
export function toImageRequest(
  family: ImageFamily,
  prompt: string,
  config: ImageGenerationConfig
): Record<string, unknown> {
  switch (family) {
    case 'titan':
      return {
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: prompt,
          negativeText: config.negativePrompt,
        },
        imageGenerationConfig: {
          numberOfImages: config.numberOfImages ?? 1,
          width: config.width,
          height: config.height,
          cfgScale: config.cfgScale,
          seed: config.seed,
          quality: config.quality,
          ...config.imageGenerationConfig,
        },
      };
    case 'stability-sdxl':
      return {
        text_prompts: [
          { text: prompt, weight: 1 },
          ...(config.negativePrompt
            ? [{ text: config.negativePrompt, weight: -1 }]
            : []),
        ],
        cfg_scale: config.cfgScale,
        seed: config.seed,
        steps: config.steps,
        width: config.width,
        height: config.height,
        style_preset: config.stylePreset,
        samples: config.numberOfImages,
        ...extraFields(config),
      };
    case 'stability':
      return {
        prompt,
        negative_prompt: config.negativePrompt,
        aspect_ratio: config.aspectRatio,
        seed: config.seed,
        output_format: 'png',
        ...extraFields(config),
      };
  }
}

/** Base64 images and, when the model filtered the output, why. */
interface ImageResult {
  images: string[];
  blocked?: string;
}

/**
 * Reads the images out of an image model's response.
 */
export function fromImageResponse(family: ImageFamily, body: any): ImageResult {
  const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  if (!body || typeof body !== 'object') return { images: [] };
  switch (family) {
    case 'titan':
      return {
        images: list(body.images).filter((i) => typeof i === 'string'),
        blocked:
          typeof body.error === 'string' && body.error ? body.error : undefined,
      };
    case 'stability-sdxl': {
      const artifacts: { base64?: string; finishReason?: string }[] = list(
        body.artifacts
      ).filter((a) => a && typeof a === 'object');
      const filtered = artifacts.find(
        (a) => a.finishReason === 'CONTENT_FILTERED'
      );
      return {
        images: artifacts
          .filter(
            (a) =>
              typeof a.base64 === 'string' &&
              a.base64 &&
              a.finishReason !== 'CONTENT_FILTERED'
          )
          .map((a) => a.base64!),
        blocked: filtered ? 'CONTENT_FILTERED' : undefined,
      };
    }
    case 'stability': {
      const reason = list(body.finish_reasons).find(
        (r) => typeof r === 'string' && r && r !== 'SUCCESS'
      );
      return {
        images: list(body.images).filter((i) => typeof i === 'string'),
        blocked: reason,
      };
    }
  }
}

/**
 * The text of the latest user message, which is the image prompt.
 */
function promptOf(request: GenerateRequest): string {
  const user = [...request.messages].reverse().find((m) => m.role === 'user');
  const prompt = user ? new Message(user).text.trim() : '';
  if (!prompt) {
    throw new GenkitError({
      status: 'INVALID_ARGUMENT',
      message: 'Image generation needs a text prompt in a user message.',
    });
  }
  return prompt;
}

/**
 * Defines a Bedrock image generation model. The prompt is the text of the
 * latest user message; each generated image comes back as an image/png media
 * part with a base64 data URL.
 */
export function awsBedrockImageModel(
  name: string,
  client: BedrockRuntimeClient
): ModelAction<typeof ImageGenerationConfigSchema> {
  const family = imageFamily(name);
  if (!family) throw new Error(`${name} is not a Bedrock image model.`);
  const ref = SUPPORTED_IMAGE_MODELS[name];

  return model(
    {
      name: `aws-bedrock/${name}`,
      label: ref?.info?.label ?? `AWS Bedrock - ${name}`,
      supports: IMAGE_SUPPORTS,
      configSchema: ImageGenerationConfigSchema,
    },
    async (request, { abortSignal }) => {
      const body = toImageRequest(
        family,
        promptOf(request),
        request.config ?? {}
      );
      let result: ImageResult;
      try {
        const response = (await client.send(
          new InvokeModelCommand({
            modelId: (request.config?.version as string) || name,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(body),
          }),
          { abortSignal }
        )) as InvokeModelCommandOutput;
        const text = response.body
          ? new TextDecoder().decode(response.body)
          : '';
        result = fromImageResponse(family, text ? JSON.parse(text) : {});
      } catch (err) {
        throw toGenkitError(err);
      }

      const content: Part[] = result.images.map((b64) => ({
        media: {
          url: `data:image/png;base64,${b64}`,
          contentType: 'image/png',
        },
      }));
      if (content.length === 0 && !result.blocked) {
        throw new GenkitError({
          status: 'INTERNAL',
          message: `AWS Bedrock returned no images from ${name}.`,
        });
      }
      return {
        finishReason: result.blocked ? 'blocked' : 'stop',
        finishMessage: result.blocked,
        message: { role: 'model', content },
      };
    }
  );
}
