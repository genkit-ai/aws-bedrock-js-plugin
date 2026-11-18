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

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import {
  embedderRef,
  rerankerRef,
  type EmbedderReference,
  type ModelReference,
  type RerankerReference,
} from 'genkit';
import { modelRef, type ModelAction } from 'genkit/model';
import {
  embedderActionMetadata,
  genkitPluginV2,
  modelActionMetadata,
  type GenkitPluginV2,
  type ResolvableAction,
} from 'genkit/plugin';
import { type ActionType } from 'genkit/registry';
import {
  __testClient,
  AwsBedrockConfigSchema,
  type AwsBedrockConfig,
  type PluginOptions,
} from './types.js';

import {
  amazonNova2MultimodalEmbeddingsV1,
  amazonTitanEmbedMultimodalV2,
  amazonTitanEmbedTextG1V1,
  amazonTitanEmbedTextV2,
  awsBedrockEmbedder,
  cohereEmbedEnglishV3,
  cohereEmbedMultilingualV3,
  cohereEmbedV4,
  embedderFamily,
  SUPPORTED_EMBEDDING_MODELS,
  TextEmbeddingConfigSchema,
  type AwsBedrockEmbedderConfig,
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
import { modelInfoFor } from './models.js';
import {
  awsBedrockReranker,
  RerankConfigSchema,
  SUPPORTED_RERANKERS,
} from './rerank.js';

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

export { type PluginOptions } from './types.js';

const PLUGIN = 'aws-bedrock';

function inferenceRegionFor(options?: PluginOptions): string {
  const region =
    typeof options?.region === 'string' ? options.region : undefined;
  if (!region) return 'us'; // default to us
  if (region.includes('us-gov')) return 'us-gov';
  if (region.includes('us')) return 'us';
  if (region.includes('eu-')) return 'eu';
  if (region.includes('ap-')) return 'apac';
  return '';
}

function clientFor(options?: PluginOptions): BedrockRuntimeClient {
  return options?.[__testClient] ?? new BedrockRuntimeClient(options || {});
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
  // Same routing as customModels and resolve: image IDs get the image model.
  return modelFor(name, clientFor(options));
}

/** Strips the plugin's namespace from an action name. */
function actionId(name: string): string {
  return name.startsWith(`${PLUGIN}/`) ? name.slice(PLUGIN.length + 1) : name;
}

/** Builds the model action for any Bedrock model ID. */
function modelFor(id: string, client: BedrockRuntimeClient) {
  return imageFamily(id)
    ? awsBedrockImageModel(id, client)
    : awsBedrockModel(id, client);
}

function awsBedrockPlugin(options?: PluginOptions): GenkitPluginV2 {
  const client = clientFor(options);
  const inferenceRegion = inferenceRegionFor(options);

  return genkitPluginV2({
    name: PLUGIN,
    init: async () => {
      const actions: ResolvableAction[] = [];

      // Register models
      for (const name of Object.keys(
        SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)
      )) {
        actions.push(awsBedrockModel(name, client));
      }

      // Register custom models if provided, skipping ones registered below
      // or above, which would otherwise be defined twice.
      const registered = new Set([
        ...Object.keys(SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)),
        ...Object.keys(SUPPORTED_IMAGE_MODELS),
      ]);
      for (const name of new Set(options?.customModels ?? [])) {
        if (registered.has(name)) continue;
        actions.push(modelFor(name, client));
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

    // Any other Bedrock ID resolves on first use: newer models and
    // inference profiles (us., eu., apac., jp., au., global., ...) work
    // without being added to the plugin. Capabilities are looked up without
    // the profile prefix; the full ID is sent to Bedrock.
    resolve: (actionType: ActionType, name: string) => {
      const id = actionId(name);
      switch (actionType) {
        case 'model':
          // Rerank and embedding models can't be called through generate().
          if (id.includes('rerank') || embedderFamily(id)) return undefined;
          return modelFor(id, client);
        case 'embedder':
          return embedderFamily(id)
            ? awsBedrockEmbedder(id, client)
            : undefined;
        case 'reranker':
          return id.includes('rerank')
            ? awsBedrockReranker(id, client)
            : undefined;
        default:
          return undefined;
      }
    },

    list: async () => [
      ...Object.keys(SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)).map((id) =>
        modelActionMetadata({
          name: `${PLUGIN}/${id}`,
          info: modelInfoFor(id),
          configSchema: AwsBedrockConfigSchema,
        })
      ),
      ...Object.values(SUPPORTED_IMAGE_MODELS).map((ref) =>
        modelActionMetadata({
          name: ref.name,
          info: ref.info,
          configSchema: ImageGenerationConfigSchema,
        })
      ),
      ...Object.values(SUPPORTED_EMBEDDING_MODELS).map((ref) =>
        embedderActionMetadata({
          name: ref.name,
          info: ref.info,
          configSchema: TextEmbeddingConfigSchema,
        })
      ),
    ],
  });
}

export type AwsBedrockPlugin = {
  (options?: PluginOptions): GenkitPluginV2;
  /** A reference to any Bedrock chat or image model, by model ID. */
  model(
    name: string,
    config?: AwsBedrockConfig
  ): ModelReference<typeof AwsBedrockConfigSchema>;
  /** A reference to any Bedrock embedding model, by model ID. */
  embedder(
    name: string,
    config?: AwsBedrockEmbedderConfig
  ): EmbedderReference<typeof TextEmbeddingConfigSchema>;
  /** A reference to a Bedrock rerank model, by model ID. */
  reranker(name: string): RerankerReference<typeof RerankConfigSchema>;
};

/**
 * The AWS Bedrock plugin.
 *
 * @example
 * ```typescript
 * const ai = genkit({ plugins: [awsBedrock({ region: 'us-east-1' })] });
 * await ai.generate({
 *   model: awsBedrock.model('global.anthropic.claude-sonnet-4-5-20250929-v1:0'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export const awsBedrock = awsBedrockPlugin as AwsBedrockPlugin;

awsBedrock.model = (name: string, config?: AwsBedrockConfig) => {
  if (imageFamily(name)) {
    return modelRef({
      name: `${PLUGIN}/${name}`,
      info: SUPPORTED_IMAGE_MODELS[name]?.info ?? {
        label: `AWS Bedrock - ${name}`,
        supports: { output: ['media'] },
      },
      configSchema: ImageGenerationConfigSchema,
      config,
    }) as unknown as ModelReference<typeof AwsBedrockConfigSchema>;
  }
  return modelRef({
    name: `${PLUGIN}/${name}`,
    info: modelInfoFor(name),
    configSchema: AwsBedrockConfigSchema,
    config,
  });
};

awsBedrock.embedder = (name: string, config?: AwsBedrockEmbedderConfig) =>
  embedderRef({
    name: `${PLUGIN}/${name}`,
    info: SUPPORTED_EMBEDDING_MODELS[name]?.info,
    configSchema: TextEmbeddingConfigSchema,
    config,
  });

awsBedrock.reranker = (name: string) =>
  rerankerRef({
    name: `${PLUGIN}/${name}`,
    configSchema: RerankConfigSchema,
  });

export default awsBedrock;
