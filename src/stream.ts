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
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
  ConverseStreamMetadataEvent,
  ReasoningContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, GenkitError, Part } from 'genkit';
import { GenerateResponseChunkData, GenerateResponseData } from 'genkit/model';
import {
  finalContent,
  fromAwsBedrockReasoning,
  fromAwsBedrockStopReason,
  fromAwsBedrockUsage,
  TRUNCATED_STOP_REASONS,
} from './converse.js';
import { toGenkitError } from './errors.js';
import { AwsBedrockConfigSchema } from './types.js';

/** A content block being reassembled from stream events. */
type StreamBlock =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; toolUseId: string; name: string; inputJson: string }
  | { kind: 'reasoning'; block: ReasoningContentBlock };

/**
 * Exceptions ConverseStream can report as stream events rather than throw.
 */
const STREAM_EXCEPTIONS = [
  'internalServerException',
  'modelStreamErrorException',
  'validationException',
  'throttlingException',
  'serviceUnavailableException',
] as const;

/**
 * Parses a streamed tool call's accumulated input, or returns the parse
 * error for input that isn't valid JSON.
 */
function parseToolInput(block: {
  inputJson: string;
}): { input: unknown } | { error: Error } {
  if (!block.inputJson.trim()) return { input: {} };
  try {
    return { input: JSON.parse(block.inputJson) };
  } catch (err) {
    return { error: err as Error };
  }
}

/**
 * Builds the part for a finished block. A tool call whose input doesn't
 * parse is dropped when the response was cut off (`truncated`): the model
 * ran out of tokens mid-call, and the finish reason says so. Otherwise the
 * invalid input is an error.
 */
function toPart(block: StreamBlock, truncated: boolean): Part | undefined {
  switch (block.kind) {
    case 'text':
      return { text: block.text };
    case 'tool': {
      const parsed = parseToolInput(block);
      if ('error' in parsed) {
        if (truncated) return undefined;
        throw new GenkitError({
          status: 'INTERNAL',
          message: `AWS Bedrock streamed invalid JSON input for tool "${block.name}": ${parsed.error.message}`,
        });
      }
      return {
        toolRequest: {
          name: block.name,
          ref: block.toolUseId,
          input: parsed.input,
        },
      };
    }
    case 'reasoning':
      return fromAwsBedrockReasoning(block.block);
  }
}

/** Joins two byte arrays without copying through a JS array. */
function concatBytes(a: Uint8Array | undefined, b: Uint8Array): Uint8Array {
  if (!a?.length) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/**
 * Runs a ConverseStream request and reassembles the response.
 *
 * Content is rebuilt per contentBlockIndex. Text and reasoning deltas are
 * sent as chunks as they arrive; a tool request is sent once its block stops
 * and its input is complete; a tool call cut off by max_tokens is dropped. The final message holds the blocks in index
 * order, the same shape the non-streaming path returns, with the finish
 * reason from messageStop and the usage from the metadata event.
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

  const blocks = new Map<number, StreamBlock>();
  let stopReason: string | undefined;
  let metadata: ConverseStreamMetadataEvent | undefined;

  const reasoningBlock = (index: number): ReasoningContentBlock => {
    const existing = blocks.get(index);
    if (existing?.kind === 'reasoning') return existing.block;
    const block: ReasoningContentBlock = { reasoningText: { text: '' } };
    blocks.set(index, { kind: 'reasoning', block });
    return block;
  };

  for await (const event of response.stream ?? []) {
    for (const key of STREAM_EXCEPTIONS) {
      const exception = (event as unknown as Record<string, unknown>)[key];
      if (exception) {
        const name = key[0].toUpperCase() + key.slice(1);
        const message = (exception as { message?: string }).message ?? name;
        throw toGenkitError(Object.assign(new Error(message), { name }));
      }
    }

    if (event.contentBlockStart) {
      const index = event.contentBlockStart.contentBlockIndex ?? 0;
      const toolUse = event.contentBlockStart.start?.toolUse;
      if (toolUse) {
        blocks.set(index, {
          kind: 'tool',
          toolUseId: toolUse.toolUseId ?? '',
          name: toolUse.name ?? '',
          inputJson: '',
        });
      }
    }

    if (event.contentBlockDelta) {
      const index = event.contentBlockDelta.contentBlockIndex ?? 0;
      const delta = event.contentBlockDelta.delta;

      if (delta?.text) {
        const block = blocks.get(index);
        if (block?.kind === 'text') {
          block.text += delta.text;
        } else {
          blocks.set(index, { kind: 'text', text: delta.text });
        }
        sendChunk({ index: 0, content: [{ text: delta.text }] });
      }

      if (delta?.toolUse?.input) {
        const block = blocks.get(index);
        if (block?.kind === 'tool') block.inputJson += delta.toolUse.input;
      }

      const r = delta?.reasoningContent;
      if (r) {
        const block = reasoningBlock(index);
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
    }

    if (event.contentBlockStop) {
      const block = blocks.get(event.contentBlockStop.contentBlockIndex ?? 0);
      // The stop reason only arrives with messageStop, so a tool call whose
      // input doesn't parse is neither sent nor rejected here; the final
      // message decides once the stop reason is known.
      if (block?.kind === 'tool') {
        const part = toPart(block, true);
        if (part) sendChunk({ index: 0, content: [part] });
      }
    }

    if (event.messageStop) {
      stopReason = event.messageStop.stopReason;
    }

    if (event.metadata) {
      metadata = event.metadata;
    }
  }

  const truncated =
    stopReason !== undefined && TRUNCATED_STOP_REASONS.has(stopReason);
  const content = [...blocks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, block]) => toPart(block, truncated))
    .filter((p): p is Part => p !== undefined);

  const jsonMode =
    request.output?.format === 'json' ||
    request.output?.contentType === 'application/json';

  return {
    finishReason: fromAwsBedrockStopReason(stopReason),
    message: {
      role: 'model',
      content: finalContent(content, jsonMode, stopReason),
    },
    usage: fromAwsBedrockUsage(metadata?.usage),
    custom: metadata ? { metrics: metadata.metrics } : {},
  };
}
