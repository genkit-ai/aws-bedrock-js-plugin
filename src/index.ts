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

import { genkitPluginV2, type ResolvableAction } from "genkit/plugin";
import {
  BedrockRuntimeClient,
  BedrockRuntimeClientConfig,
} from "@aws-sdk/client-bedrock-runtime";
import { ModelAction } from "genkit/model";
import { GenerationCommonConfigSchema } from "genkit";

import {
  awsBedrockModel,
  amazonNovaProV1,
  amazonNovaLiteV1,
  amazonNovaMicroV1,
  amazonTitanTextG1PremierV1,
  amazonTitanTextG1ExpressV1,
  amazonTitanTextG1LiteV1,
  cohereCommandRV1,
  cohereCommandRPlusV1,
  cohereCommandLightV14,
  cohereCommandV14,
  mistralLarge2402V1,
  mistralSmall2402V1,
  mistral7BInstructV02,
  mistral8x7BInstructV01,
  anthropicClaude35HaikuV1,
  anthropicClaude37SonnetV1,
  anthropicClaude35SonnetV2,
  anthropicClaude3OpusV1,
  anthropicClaude3HaikuV1,
  anthropicClaude3SonnetV1,
  anthropicClaude21V1,
  anthropicClaude2V1,
  anthropicClaudeInstantV1,
  ai21Jamba15LargeV1,
  ai21Jamba15MiniV1,
  ai21JambaInstructV1,
  ai21Jurassic2MidV1,
  ai21Jurassic2UltraV1,
  metaLlama3370BInstruct,
  metaLlama3211BInstruct,
  metaLlama321BInstruct,
  metaLlama323BInstruct,
  metaLlama3290BInstruct,
  metaLlama3170BInstruct,
  metaLlama318BInstruct,
  metaLlama370BInstruct,
  metaLlama38BInstruct,
  SUPPORTED_AWS_BEDROCK_MODELS,
} from "./aws_bedrock_llms.js";
import {
  awsBedrockEmbedder,
  amazonTitanEmbedTextV2,
  amazonTitanEmbedMultimodalV2,
  amazonTitanEmbedTextG1V1,
  cohereEmbedEnglishV3,
  cohereEmbedMultilingualV3,
  SUPPORTED_EMBEDDING_MODELS,
} from "./aws_bedrock_embedders.js";

import {
  onCallGenkit,
  allowAll,
  requireHeader,
  requireBearerToken,
  requireApiKey,
  allOf,
  anyOf,
  type FlowRunOptions,
  type LambdaOptions,
  type CorsOptions,
  type FlowResponse,
  type FlowErrorResponse,
  type LambdaFlowResponse,
  type LambdaHandler,
  type LambdaHandlerV2,
  type CallableLambdaFunction,
} from "./aws_lambda.js";

export {
  amazonNovaProV1,
  amazonNovaLiteV1,
  amazonNovaMicroV1,
  amazonTitanTextG1PremierV1,
  amazonTitanTextG1ExpressV1,
  amazonTitanTextG1LiteV1,
  cohereCommandRV1,
  cohereCommandRPlusV1,
  cohereCommandLightV14,
  cohereCommandV14,
  mistralLarge2402V1,
  mistralSmall2402V1,
  mistral7BInstructV02,
  mistral8x7BInstructV01,
  ai21Jamba15LargeV1,
  ai21Jamba15MiniV1,
  ai21JambaInstructV1,
  ai21Jurassic2MidV1,
  ai21Jurassic2UltraV1,
  metaLlama3370BInstruct,
  metaLlama3211BInstruct,
  metaLlama321BInstruct,
  metaLlama323BInstruct,
  metaLlama3290BInstruct,
  metaLlama3170BInstruct,
  metaLlama318BInstruct,
  metaLlama370BInstruct,
  metaLlama38BInstruct,
  anthropicClaude35HaikuV1,
  anthropicClaude37SonnetV1,
  anthropicClaude35SonnetV2,
  anthropicClaude3OpusV1,
  anthropicClaude3HaikuV1,
  anthropicClaude3SonnetV1,
  anthropicClaude21V1,
  anthropicClaude2V1,
  anthropicClaudeInstantV1,
};

export {
  amazonTitanEmbedTextV2,
  amazonTitanEmbedMultimodalV2,
  amazonTitanEmbedTextG1V1,
  cohereEmbedEnglishV3,
  cohereEmbedMultilingualV3,
};

// AWS Lambda exports
export {
  onCallGenkit,
  allowAll,
  requireHeader,
  requireBearerToken,
  requireApiKey,
  allOf,
  anyOf,
};

export type {
  FlowRunOptions,
  LambdaOptions,
  CorsOptions,
  FlowResponse,
  FlowErrorResponse,
  LambdaFlowResponse,
  LambdaHandler,
  LambdaHandlerV2,
  CallableLambdaFunction,
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
  options?: PluginOptions,
): ModelAction<typeof GenerationCommonConfigSchema> {
  const client = new BedrockRuntimeClient(options || {});

  const region =
    typeof options?.region === "string" ? options.region : undefined;
  let inferenceRegion = "";
  if (!region) {
    inferenceRegion = "us"; // default to us
  } else if (region.includes("us-gov")) {
    inferenceRegion = "us-gov";
  } else if (region.includes("us")) {
    inferenceRegion = "us";
  } else if (region.includes("eu-")) {
    inferenceRegion = "eu";
  } else if (region.includes("ap-")) {
    inferenceRegion = "apac";
  }

  return awsBedrockModel(name, client, inferenceRegion);
}

export function awsBedrock(options?: PluginOptions) {
  const client = new BedrockRuntimeClient(options || {});

  const region =
    typeof options?.region === "string" ? options.region : undefined;
  let inferenceRegion = "";
  if (!region) {
    inferenceRegion = "us"; // default to us
  } else if (region.includes("us-gov")) {
    inferenceRegion = "us-gov";
  } else if (region.includes("us")) {
    inferenceRegion = "us";
  } else if (region.includes("eu-")) {
    inferenceRegion = "eu";
  } else if (region.includes("ap-")) {
    inferenceRegion = "apac";
  }

  return genkitPluginV2({
    name: "aws-bedrock",
    init: async () => {
      const actions: ResolvableAction[] = [];

      // Register models
      for (const name of Object.keys(
        SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion),
      )) {
        actions.push(awsBedrockModel(name, client, inferenceRegion));
      }

      // Register custom models if provided
      if (options?.customModels) {
        for (const name of options.customModels) {
          actions.push(awsBedrockModel(name, client, inferenceRegion));
        }
      }

      // Register embedders
      for (const name of Object.keys(SUPPORTED_EMBEDDING_MODELS)) {
        actions.push(awsBedrockEmbedder(name, client));
      }

      return actions;
    },
  });
}

export default awsBedrock;
