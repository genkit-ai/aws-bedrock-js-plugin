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
import { GenerateRequest } from 'genkit';
import { GenerateResponseChunkData, ModelAction } from 'genkit/model';
import { model } from 'genkit/plugin';
import { AwsBedrockConfigSchema } from './types.js';

import { fromAwsBedrockChoice, toAwsBedrockRequestBody } from './converse.js';
import { toGenkitError } from './errors.js';
import { modelInfoFor } from './models.js';
import { converseStream } from './stream.js';

export function awsBedrockModel(
  name: string,
  client: BedrockRuntimeClient,
  inferenceRegion: string
): ModelAction<typeof AwsBedrockConfigSchema> {
  const info = modelInfoFor(name);
  const modelInfo = {
    name: `aws-bedrock/${name}`,
    label: info.label,
    supports: info.supports,
    configSchema: AwsBedrockConfigSchema,
  };

  return model(
    modelInfo,
    async (
      request: GenerateRequest<typeof AwsBedrockConfigSchema>,
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
        // streamProcessingMode is only valid on ConverseStream.
        if (body.guardrailConfig) {
          body.guardrailConfig = { ...body.guardrailConfig };
          delete (body.guardrailConfig as { streamProcessingMode?: string })
            .streamProcessingMode;
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
