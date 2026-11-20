/**
 * Copyright 2026 Xavier Portilla Edo
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

import {
  BedrockRuntimeClient,
  BedrockRuntimeClientConfig,
} from '@aws-sdk/client-bedrock-runtime';
import { ModelAction } from 'genkit/model';
import { genkitPluginV2, type ResolvableAction } from 'genkit/plugin';
import { AwsBedrockConfigSchema } from './types.js';

import {
  amazonNova2MultimodalEmbeddingsV1,
  amazonTitanEmbedMultimodalV2,
  amazonTitanEmbedTextG1V1,
  amazonTitanEmbedTextV2,
  awsBedrockEmbedder,
  cohereEmbedEnglishV3,
  cohereEmbedMultilingualV3,
  cohereEmbedV4,
  SUPPORTED_EMBEDDING_MODELS,
} from './aws_bedrock_embedders.js';
import {
  ai21Jamba15LargeV1,
  ai21Jamba15MiniV1,
  ai21JambaInstructV1,
  ai21Jurassic2MidV1,
  ai21Jurassic2UltraV1,
  amazonNova2LiteV1,
  amazonNovaLiteV1,
  amazonNovaMicroV1,
  amazonNovaPremierV1,
  amazonNovaProV1,
  amazonTitanTextG1ExpressV1,
  amazonTitanTextG1LiteV1,
  amazonTitanTextG1PremierV1,
  anthropicClaude21V1,
  anthropicClaude2V1,
  anthropicClaude35HaikuV1,
  anthropicClaude35SonnetV1,
  anthropicClaude35SonnetV2,
  anthropicClaude37SonnetV1,
  anthropicClaude3HaikuV1,
  anthropicClaude3OpusV1,
  anthropicClaude3SonnetV1,
  anthropicClaudeHaiku45V1,
  anthropicClaudeInstantV1,
  anthropicClaudeOpus41V1,
  anthropicClaudeOpus45V1,
  anthropicClaudeOpus46V1,
  anthropicClaudeOpus4V1,
  anthropicClaudeSonnet45V1,
  anthropicClaudeSonnet46V1,
  anthropicClaudeSonnet4V1,
  awsBedrockModel,
  cohereCommandLightV14,
  cohereCommandRPlusV1,
  cohereCommandRV1,
  cohereCommandV14,
  cohereRerank35V1,
  googleGemma312BIt,
  metaLlama3170BInstruct,
  metaLlama318BInstruct,
  metaLlama3211BInstruct,
  metaLlama321BInstruct,
  metaLlama323BInstruct,
  metaLlama3290BInstruct,
  metaLlama3370BInstruct,
  metaLlama370BInstruct,
  metaLlama38BInstruct,
  metaLlama4Maverick17BInstruct,
  metaLlama4Scout17BInstruct,
  mistral7BInstructV02,
  mistral8x7BInstructV01,
  mistralLarge2402V1,
  mistralLarge3675BInstruct,
  mistralMagistralSmall2509,
  mistralMinistral314BInstruct,
  mistralMinistral33BInstruct,
  mistralMinistral38BInstruct,
  mistralSmall2402V1,
  pixtralLarge2502V1,
  SUPPORTED_AWS_BEDROCK_MODELS,
} from './aws_bedrock_llms.js';

import {
  awsBedrockImageModel,
  imageFamily,
  ImageGenerationConfigSchema,
  SUPPORTED_IMAGE_MODELS,
} from './image.js';
import { awsBedrockReranker, SUPPORTED_RERANKERS } from './rerank.js';

import {
  allOf,
  allowAll,
  anyOf,
  onCallGenkit,
  requireApiKey,
  requireBearerToken,
  requireHeader,
  type ActionContext,
  type ApiKeyContext,
  type BearerTokenContext,
  type CallableLambdaFunction,
  type ContextProvider,
  type CorsOptions,
  type FlowErrorResponse,
  type FlowResponse,
  type FlowRunOptions,
  type LambdaActionContext,
  type LambdaFlowResponse,
  type LambdaHandler,
  type LambdaHandlerV2,
  type LambdaOptions,
  type RequestData,
} from './aws_lambda.js';

export {
  ai21Jamba15LargeV1,
  ai21Jamba15MiniV1,
  ai21JambaInstructV1,
  ai21Jurassic2MidV1,
  ai21Jurassic2UltraV1,
  amazonNova2LiteV1,
  amazonNovaLiteV1,
  amazonNovaMicroV1,
  amazonNovaPremierV1,
  amazonNovaProV1,
  amazonTitanTextG1ExpressV1,
  amazonTitanTextG1LiteV1,
  amazonTitanTextG1PremierV1,
  anthropicClaude21V1,
  anthropicClaude2V1,
  anthropicClaude35HaikuV1,
  anthropicClaude35SonnetV1,
  anthropicClaude35SonnetV2,
  anthropicClaude37SonnetV1,
  anthropicClaude3HaikuV1,
  anthropicClaude3OpusV1,
  anthropicClaude3SonnetV1,
  anthropicClaudeHaiku45V1,
  anthropicClaudeInstantV1,
  anthropicClaudeOpus41V1,
  anthropicClaudeOpus45V1,
  anthropicClaudeOpus46V1,
  anthropicClaudeOpus4V1,
  anthropicClaudeSonnet45V1,
  anthropicClaudeSonnet46V1,
  anthropicClaudeSonnet4V1,
  cohereCommandLightV14,
  cohereCommandRPlusV1,
  cohereCommandRV1,
  cohereCommandV14,
  cohereRerank35V1,
  googleGemma312BIt,
  metaLlama3170BInstruct,
  metaLlama318BInstruct,
  metaLlama3211BInstruct,
  metaLlama321BInstruct,
  metaLlama323BInstruct,
  metaLlama3290BInstruct,
  metaLlama3370BInstruct,
  metaLlama370BInstruct,
  metaLlama38BInstruct,
  metaLlama4Maverick17BInstruct,
  metaLlama4Scout17BInstruct,
  mistral7BInstructV02,
  mistral8x7BInstructV01,
  mistralLarge2402V1,
  mistralLarge3675BInstruct,
  mistralMagistralSmall2509,
  mistralMinistral314BInstruct,
  mistralMinistral33BInstruct,
  mistralMinistral38BInstruct,
  mistralSmall2402V1,
  pixtralLarge2502V1,
};

export {
  amazonNovaCanvasV1,
  amazonTitanImageGeneratorV2,
  ImageGenerationConfigSchema,
  stabilitySd35LargeV1,
  stabilityStableImageCoreV1,
  stabilityStableImageUltraV1,
  type ImageGenerationConfig,
} from './image.js';

export {
  cohereRerank35,
  RerankConfigSchema,
  type RerankConfig,
} from './rerank.js';

export {
  AwsBedrockConfigSchema,
  CachePointSchema,
  type AwsBedrockConfig,
} from './types.js';

export {
  amazonNova2MultimodalEmbeddingsV1,
  amazonTitanEmbedMultimodalV2,
  amazonTitanEmbedTextG1V1,
  amazonTitanEmbedTextV2,
  cohereEmbedEnglishV3,
  cohereEmbedMultilingualV3,
  cohereEmbedV4,
};

// AWS Lambda exports
export {
  allOf,
  allowAll,
  anyOf,
  onCallGenkit,
  requireApiKey,
  requireBearerToken,
  requireHeader,
};

export type {
  ActionContext,
  ApiKeyContext,
  BearerTokenContext,
  CallableLambdaFunction,
  ContextProvider,
  CorsOptions,
  FlowErrorResponse,
  FlowResponse,
  FlowRunOptions,
  LambdaActionContext,
  LambdaFlowResponse,
  LambdaHandler,
  LambdaHandlerV2,
  LambdaOptions,
  RequestData,
};

export interface PluginOptions extends BedrockRuntimeClientConfig {
  /**
   * Additional model names to register that are not in the predefined list.
   * These models will be available using the 'aws-bedrock/model-name' format.
   * @example ['custom.my-custom-model-v1:0']
   */
  customModels?: string[];
}

/**
 * Defines a custom AWS Bedrock model that is not exported by the plugin
 * @param name - The name of the model (e.g., "custom.my-model-v1:0")
 * @param options - Plugin options including AWS credentials and region
 * @returns A ModelAction that can be used with Genkit
 *
 * @example
 * ```typescript
 * import { defineAwsBedrockModel } from 'genkitx-aws-bedrock';
 *
 * const customModel = defineAwsBedrockModel('custom.my-model-v1:0', {
 *   region: 'us-east-1'
 * });
 *
 * const response = await ai.generate({
 *   model: customModel,
 *   prompt: 'Hello!'
 * });
 * ```
 */
export function defineAwsBedrockModel(
  name: string,
  options?: PluginOptions
): ModelAction<
  typeof AwsBedrockConfigSchema | typeof ImageGenerationConfigSchema
> {
  const client = new BedrockRuntimeClient(options || {});

  const region =
    typeof options?.region === 'string' ? options.region : undefined;
  let inferenceRegion = '';
  if (!region) {
    inferenceRegion = 'us'; // default to us
  } else if (region.includes('us-gov')) {
    inferenceRegion = 'us-gov';
  } else if (region.includes('us')) {
    inferenceRegion = 'us';
  } else if (region.includes('eu-')) {
    inferenceRegion = 'eu';
  } else if (region.includes('ap-')) {
    inferenceRegion = 'apac';
  }

  // Same routing as customModels: image model IDs get the image model.
  return imageFamily(name)
    ? awsBedrockImageModel(name, client)
    : awsBedrockModel(name, client, inferenceRegion);
}

export function awsBedrock(options?: PluginOptions) {
  const client = new BedrockRuntimeClient(options || {});

  const region =
    typeof options?.region === 'string' ? options.region : undefined;
  let inferenceRegion = '';
  if (!region) {
    inferenceRegion = 'us'; // default to us
  } else if (region.includes('us-gov')) {
    inferenceRegion = 'us-gov';
  } else if (region.includes('us')) {
    inferenceRegion = 'us';
  } else if (region.includes('eu-')) {
    inferenceRegion = 'eu';
  } else if (region.includes('ap-')) {
    inferenceRegion = 'apac';
  }

  return genkitPluginV2({
    name: 'aws-bedrock',
    init: async () => {
      const actions: ResolvableAction[] = [];

      // Register models
      for (const name of Object.keys(
        SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)
      )) {
        actions.push(awsBedrockModel(name, client, inferenceRegion));
      }

      // Register custom models if provided, skipping ones registered below
      // or above, which would otherwise be defined twice.
      if (options?.customModels) {
        const registered = new Set([
          ...Object.keys(SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)),
          ...Object.keys(SUPPORTED_IMAGE_MODELS),
        ]);
        for (const name of new Set(options.customModels)) {
          if (registered.has(name)) continue;
          actions.push(
            imageFamily(name)
              ? awsBedrockImageModel(name, client)
              : awsBedrockModel(name, client, inferenceRegion)
          );
        }
      }

      // Register image models
      for (const name of Object.keys(SUPPORTED_IMAGE_MODELS)) {
        actions.push(awsBedrockImageModel(name, client));
      }

      // Register embedders
      for (const name of Object.keys(SUPPORTED_EMBEDDING_MODELS)) {
        actions.push(awsBedrockEmbedder(name, client));
      }

      // Register rerankers
      for (const name of Object.keys(SUPPORTED_RERANKERS)) {
        actions.push(awsBedrockReranker(name, client));
      }

      return actions;
    },
  });
}

export default awsBedrock;
