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
  ReasoningContentBlock,
  ToolUseBlockStart,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, Part } from 'genkit';
import { GenerateResponseChunkData, GenerateResponseData } from 'genkit/model';
import { fromAwsBedrockReasoning } from './converse.js';
import { AwsBedrockConfigSchema } from './types.js';

/** Joins two byte arrays without copying through a JS array. */
function concatBytes(a: Uint8Array | undefined, b: Uint8Array): Uint8Array {
  if (!a?.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/**
 * Runs a ConverseStream request, forwarding text and reasoning deltas to
 * `sendChunk`, and
 * returns the reassembled response.
 */
export async function converseStream(
  client: BedrockRuntimeClient,
  body: ConverseStreamCommandInput,
  request: GenerateRequest<typeof AwsBedrockConfigSchema>,
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

  // Reasoning blocks, by contentBlockIndex.
  const reasoningBlocks: Map<number, ReasoningContentBlock> = new Map();
  const reasoningBlock = (index: number) => {
    let block = reasoningBlocks.get(index);
    if (!block) {
      block = { reasoningText: { text: '' } };
      reasoningBlocks.set(index, block);
    }
    return block;
  };

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

      // Handle reasoning deltas: stream the text, keep the signature and
      // any redacted bytes for the final message.
      if (delta && 'reasoningContent' in delta && delta.reasoningContent) {
        const r = delta.reasoningContent;
        const block = reasoningBlock(blockIndex);
        if (r.text) {
          block.reasoningText!.text += r.text;
          sendChunk({ index: 0, content: [{ reasoning: r.text }] });
        }
        if (r.signature) {
          block.reasoningText!.signature =
            (block.reasoningText!.signature ?? '') + r.signature;
        }
        if (r.redactedContent?.length) {
          block.redactedContent = concatBytes(
            block.redactedContent,
            r.redactedContent
          );
        }
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

  const reasoningParts = [...reasoningBlocks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, block]) => fromAwsBedrockReasoning(block))
    .filter((p): p is Part => p !== undefined);

  return {
    message: {
      role: 'model' as const,
      content: [...reasoningParts, ...content],
    },
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
    custom: response,
  };
}
