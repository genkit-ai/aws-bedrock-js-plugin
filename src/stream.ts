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
  ContentBlockDelta,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
  ToolUseBlockStart,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, GenerationCommonConfigSchema, Part } from 'genkit';
import { GenerateResponseChunkData, GenerateResponseData } from 'genkit/model';

/**
 * Runs a ConverseStream request, forwarding text deltas to `sendChunk`, and
 * returns the reassembled response.
 */
export async function converseStream(
  client: BedrockRuntimeClient,
  body: ConverseStreamCommandInput,
  request: GenerateRequest<typeof GenerationCommonConfigSchema>,
  sendChunk: (chunk: GenerateResponseChunkData) => void,
  abortSignal: AbortSignal
): Promise<GenerateResponseData> {
  const command = new ConverseStreamCommand(body);
  const response: ConverseStreamCommandOutput = await client.send(command, {
    abortSignal,
  });

  // Accumulate text content from streaming response
  let accumulatedText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  // Track tool use blocks for streaming
  // Map from contentBlockIndex to tool use info
  const toolUseBlocks: Map<
    number,
    { toolUseId: string; name: string; inputJson: string }
  > = new Map();

  for await (const event of response.stream!) {
    if (event.messageStop) {
      sendChunk({
        index: 0,
        content: [],
      });
    }

    // Handle tool use start events - these contain toolUseId and name
    if (event.contentBlockStart) {
      const startBlock = event.contentBlockStart;
      const blockIndex = startBlock.contentBlockIndex ?? 0;
      if (
        startBlock.start &&
        'toolUse' in startBlock.start &&
        startBlock.start.toolUse
      ) {
        const toolStart = startBlock.start.toolUse as ToolUseBlockStart;
        toolUseBlocks.set(blockIndex, {
          toolUseId: toolStart.toolUseId || '',
          name: toolStart.name || '',
          inputJson: '',
        });
      }
    }

    if (event.contentBlockDelta) {
      const blockIndex = event.contentBlockDelta.contentBlockIndex ?? 0;
      const delta = event.contentBlockDelta.delta as ContentBlockDelta;

      // Handle text deltas
      if (delta && 'text' in delta && delta.text) {
        accumulatedText += delta.text;
        sendChunk({
          index: 0,
          content: [{ text: delta.text }],
        });
      }

      // Handle tool use input deltas - accumulate the JSON input
      if (delta && 'toolUse' in delta && delta.toolUse) {
        const toolUseDelta = delta.toolUse;
        const existingBlock = toolUseBlocks.get(blockIndex);
        if (existingBlock && toolUseDelta.input) {
          existingBlock.inputJson += toolUseDelta.input;
        }
      }
    }

    // Capture usage metadata from the stream
    if (event.metadata?.usage) {
      inputTokens = event.metadata.usage.inputTokens || 0;
      outputTokens = event.metadata.usage.outputTokens || 0;
      totalTokens = event.metadata.usage.totalTokens || 0;
    }
  }

  // Build tool request parts from accumulated tool use blocks
  const toolRequestParts: Part[] = [];
  for (const [, toolBlock] of toolUseBlocks) {
    if (toolBlock.name && toolBlock.toolUseId) {
      let parsedInput = {};
      try {
        if (toolBlock.inputJson) {
          parsedInput = JSON.parse(toolBlock.inputJson);
        }
      } catch {
        // If JSON parsing fails, use empty object
        parsedInput = {};
      }
      toolRequestParts.push({
        toolRequest: {
          name: toolBlock.name,
          ref: toolBlock.toolUseId,
          input: parsedInput,
        },
      });
    }
  }

  // Return accumulated content for streaming
  const jsonMode = request.output?.format === 'json';

  // If we have tool calls, return them; otherwise return text content
  const content: Part[] =
    toolRequestParts.length > 0
      ? toolRequestParts
      : [
          jsonMode
            ? { data: accumulatedText ? JSON.parse(accumulatedText) : {} }
            : { text: accumulatedText },
        ];

  return {
    message: {
      role: 'model' as const,
      content,
    },
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
    custom: response,
  };
}
