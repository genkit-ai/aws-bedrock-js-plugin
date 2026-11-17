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
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, GenerationCommonConfigSchema } from 'genkit';
import { GenerateResponseChunkData, ModelAction } from 'genkit/model';
import { model } from 'genkit/plugin';

import { fromAwsBedrockChoice, toAwsBedrockRequestBody } from './converse.js';
import { toGenkitError } from './errors.js';
import { SUPPORTED_AWS_BEDROCK_MODELS } from './models.js';
import { converseStream } from './stream.js';

export function awsBedrockModel(
  name: string,
  client: BedrockRuntimeClient,
  inferenceRegion: string
): ModelAction<typeof GenerationCommonConfigSchema> {
  const modelId = `aws-bedrock/${name}`;
  const modelReference = SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)[name];

  // If model is not in the supported list, create a default configuration
  const modelInfo = modelReference
    ? {
        name: modelId,
        ...modelReference.info,
        configSchema:
          SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)[name].configSchema,
      }
    : {
        name: modelId,
        info: {
          label: `AWS Bedrock - ${name}`,
          supports: {
            multiturn: true,
            tools: true,
            media: true,
            systemRole: true,
            output: ['text', 'json'],
          },
        },
        configSchema: GenerationCommonConfigSchema,
      };

  return model(
    modelInfo,
    async (
      request: GenerateRequest<typeof GenerationCommonConfigSchema>,
      {
        streamingRequested,
        sendChunk,
        abortSignal,
      }: {
        streamingRequested: boolean;
        sendChunk: (chunk: GenerateResponseChunkData) => void;
        abortSignal: AbortSignal;
      }
    ) => {
      const body = toAwsBedrockRequestBody(name, request, inferenceRegion);
      const jsonMode =
        request.output?.format === 'json' ||
        request.output?.contentType === 'application/json';
      try {
        if (streamingRequested) {
          return await converseStream(
            client,
            body,
            request,
            sendChunk,
            abortSignal
          );
        }
        const converseResponse = await client.send(new ConverseCommand(body), {
          abortSignal,
        });
        return {
          ...fromAwsBedrockChoice(converseResponse, jsonMode),
          custom: converseResponse,
        };
      } catch (err) {
        throw toGenkitError(err);
      }
    }
  );
}
