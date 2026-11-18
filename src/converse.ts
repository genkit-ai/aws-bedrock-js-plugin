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
/* eslint-disable  @typescript-eslint/no-explicit-any */

import {
  Message as AwsMessge,
  CachePointBlock,
  CacheTTL,
  ContentBlock,
  ConversationRole,
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  DocumentFormat,
  ImageFormat,
  OutputFormatType,
  ReasoningContentBlock,
  SystemContentBlock,
  TokenUsage,
  Tool,
  ToolChoice,
  ToolConfiguration,
  VideoFormat,
} from '@aws-sdk/client-bedrock-runtime';
import { GenerateRequest, GenkitError, MessageData, Part, Role } from 'genkit';
import {
  GenerationUsage,
  ModelResponseData,
  ToolDefinition,
} from 'genkit/model';
import { createHash } from 'node:crypto';
import { AwsBedrockConfig, AwsBedrockConfigSchema } from './types.js';

import { SUPPORTED_AWS_BEDROCK_MODELS } from './models.js';

function toAwsBedrockRole(role: Role): ConversationRole | 'system' {
  switch (role) {
    case 'user':
    case 'tool':
      // Tool results go back to Bedrock in a user message.
      return 'user';
    case 'model':
      return 'assistant';
    case 'system':
      return 'system';
    default:
      throw new Error(`role ${role} doesn't map to an AWS Bedrock role.`);
  }
}

function toAwsBedrockTool(tool: ToolDefinition): Tool {
  // Handle both inputSchema and inputJsonSchema (from MCP tools)
  // inputJsonSchema is mutually exclusive with inputSchema in ToolConfig
  const schema = tool.inputSchema || (tool as any).inputJsonSchema;
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: schema ? { json: schema } : undefined,
    },
  };
}

/**
 * Map of MIME types to Bedrock image formats.
 */
export const MIME_TO_IMAGE_FORMAT: Record<string, ImageFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Map of MIME types to Bedrock document formats.
 */
const MIME_TO_DOCUMENT_FORMAT: Record<string, DocumentFormat> = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/markdown': 'md',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/**
 * Map of MIME types to Bedrock video formats.
 */
export const MIME_TO_VIDEO_FORMAT: Record<string, VideoFormat> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'video/x-flv': 'flv',
  'video/mpeg': 'mpeg',
  'video/mpg': 'mpg',
  'video/x-ms-wmv': 'wmv',
  'video/3gpp': 'three_gp',
};

/**
 * Returns the media part's MIME type, taken from `contentType` or else from
 * a data URL, lowercased and without parameters.
 */
function mediaContentType(media: {
  url: string;
  contentType?: string;
}): string | undefined {
  let contentType = media.contentType;
  if (!contentType && media.url.startsWith('data:')) {
    contentType = media.url.slice(5).split(/[;,]/)[0];
  }
  contentType = contentType?.split(';')[0].trim().toLowerCase();
  return contentType || undefined;
}

/**
 * Where Bedrock should read media from: inline bytes, or an S3 object.
 */
type MediaSource = { bytes: Uint8Array } | { s3Location: { uri: string } };

function mediaSource(url: string): MediaSource {
  if (url.startsWith('s3://')) {
    return { s3Location: { uri: url } };
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    throw new Error(
      'AWS Bedrock does not fetch remote media URLs. Pass the media as a base64 data URL or an s3:// URI.'
    );
  }
  let data = url;
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0 || !url.slice(0, comma).endsWith(';base64')) {
      throw new Error(
        'Media data URLs must be base64-encoded (data:<type>;base64,...).'
      );
    }
    data = url.slice(comma + 1);
  }
  return { bytes: new Uint8Array(Buffer.from(data, 'base64')) };
}

/**
 * Guesses an image format from its first bytes. Used only when a media part
 * has no content type at all.
 */
function sniffImageFormat(source: MediaSource): ImageFormat | undefined {
  if (!('bytes' in source)) return undefined;
  const b = source.bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'png';
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'webp';
  }
  return undefined;
}

/**
 * Generates a document name from its format and content.
 * AWS Bedrock document names can only contain alphanumeric characters,
 * whitespace, hyphens, parentheses, and square brackets (no dots/periods).
 * The name is a hash of the document's bytes or S3 URI, so the same document
 * gets the same name on every request and prompt-cache points still match.
 * @param format The document format.
 * @param source Where Bedrock reads the document from.
 * @returns A valid, stable document name.
 */
function generateFilenameFromFormat(
  format: DocumentFormat,
  source: MediaSource
): string {
  const hash = createHash('sha256')
    .update('bytes' in source ? source.bytes : source.s3Location.uri)
    .digest('hex')
    .slice(0, 16);
  return `document-${format}-${hash}`;
}

/**
 * Returns the Bedrock cache point a part asks for in `metadata.cachePoint`,
 * if any. See CachePointSchema.
 */
function cachePointFor(part: Part): CachePointBlock | undefined {
  const value = part.metadata?.cachePoint;
  if (value === true || value === 'default') return { type: 'default' };
  if (value && typeof value === 'object') {
    const { ttl } = value as { ttl?: CacheTTL };
    return ttl ? { type: 'default', ttl } : { type: 'default' };
  }
  return undefined;
}

/**
 * Converts a text or media part to a Bedrock content block.
 *
 * Images, documents and videos are chosen by MIME type, taken from the part's
 * `contentType` or its data URL. Media can be a base64 data URL or an s3://
 * URI; remote http(s) URLs are rejected because Bedrock does not fetch them.
 *
 * @param imageFormat Used only for a media part with no content type whose
 *   bytes are not a recognisable image.
 */
export function toAwsBedrockTextAndMedia(
  part: Part,
  imageFormat: ImageFormat = 'png'
): ContentBlock {
  if (part.text !== undefined) {
    return { text: part.text };
  }
  if (part.media) {
    const contentType = mediaContentType(part.media);
    const source = mediaSource(part.media.url);

    if (!contentType) {
      // Legacy behaviour: media without a content type is sent as an image.
      return {
        image: {
          source,
          format: sniffImageFormat(source) ?? imageFormat,
        },
      };
    }

    const docFormat = MIME_TO_DOCUMENT_FORMAT[contentType];
    if (docFormat) {
      return {
        document: {
          name: generateFilenameFromFormat(docFormat, source),
          format: docFormat,
          source,
        },
      };
    }

    const image = MIME_TO_IMAGE_FORMAT[contentType];
    if (image) {
      return { image: { source, format: image } };
    }

    const video = MIME_TO_VIDEO_FORMAT[contentType];
    if (video) {
      return { video: { source, format: video } };
    }

    throw new Error(
      `Unsupported media content type: ${contentType}. Supported types are png, jpeg, gif and webp images, documents (pdf, csv, txt, html, md, doc, docx, xls, xlsx) and videos (mp4, mov, mkv, webm, flv, mpeg, mpg, wmv, 3gp).`
    );
  }
  throw new Error(
    `Unsupported genkit part fields encountered for current message role: ${JSON.stringify(part)}.`
  );
}

/**
 * Returns the text of every system message, in order, or null when the
 * request has none.
 */
export function getSystemMessage(
  messages: MessageData[]
): SystemContentBlock[] | null {
  const blocks: SystemContentBlock[] = [];
  for (const message of messages) {
    if (message.role !== 'system') continue;
    for (const part of message.content) {
      if (part.text) blocks.push({ text: part.text });
      const cachePoint = cachePointFor(part);
      if (cachePoint) blocks.push({ cachePoint });
    }
  }
  return blocks.length > 0 ? blocks : null;
}

/**
 * Part metadata keys that carry Bedrock reasoning across turns. Claude
 * rejects a follow-up request unless its signed (or redacted) reasoning is
 * sent back unchanged, so the signature and the redacted bytes (base64) are
 * kept on the reasoning part. The keys match the Go plugin.
 */
export const REASONING_SIGNATURE_KEY = 'bedrockReasoningSignature';
export const REDACTED_REASONING_KEY = 'bedrockRedactedContent';

/**
 * Converts a Bedrock reasoning block to a Genkit reasoning part, or returns
 * undefined for an empty block.
 */
export function fromAwsBedrockReasoning(
  block: ReasoningContentBlock
): Part | undefined {
  if (block.redactedContent?.length) {
    return {
      reasoning: '',
      metadata: {
        [REDACTED_REASONING_KEY]: Buffer.from(block.redactedContent).toString(
          'base64'
        ),
      },
    };
  }
  const text = block.reasoningText?.text;
  const signature = block.reasoningText?.signature;
  if (!text && !signature) return undefined;
  return signature
    ? {
        reasoning: text ?? '',
        metadata: { [REASONING_SIGNATURE_KEY]: signature },
      }
    : { reasoning: text ?? '' };
}

/**
 * Converts a Genkit reasoning part back to Bedrock reasoning blocks. Only
 * reasoning that Bedrock produced (it carries a signature or redacted bytes)
 * is sent; reasoning from other providers is dropped, since Bedrock would
 * reject it.
 */
function toAwsBedrockReasoning(part: Part): ContentBlock[] {
  const redacted = part.metadata?.[REDACTED_REASONING_KEY];
  if (typeof redacted === 'string' && redacted) {
    return [
      {
        reasoningContent: {
          redactedContent: new Uint8Array(Buffer.from(redacted, 'base64')),
        },
      },
    ];
  }
  const signature = part.metadata?.[REASONING_SIGNATURE_KEY];
  // Claude can sign reasoning with empty text; it still has to go back.
  if (
    typeof signature === 'string' &&
    signature &&
    typeof part.reasoning === 'string'
  ) {
    return [
      {
        reasoningContent: {
          reasoningText: { text: part.reasoning, signature },
        },
      },
    ];
  }
  return [];
}

/**
 * Converts one Genkit part of a user, model or tool message to Bedrock
 * content blocks.
 */
function toContentBlocks(part: Part, imageFormat: ImageFormat): ContentBlock[] {
  if (part.text !== undefined) {
    // Bedrock rejects blank text blocks.
    return part.text.trim() ? [{ text: part.text }] : [];
  }
  if (part.media) {
    return [toAwsBedrockTextAndMedia(part, imageFormat)];
  }
  if (part.toolRequest) {
    return [
      {
        toolUse: {
          toolUseId: part.toolRequest.ref || '',
          name: part.toolRequest.name,
          input: (part.toolRequest.input ?? {}) as any,
        },
      },
    ];
  }
  if (part.toolResponse) {
    return [
      {
        toolResult: {
          toolUseId: part.toolResponse.ref || '',
          content: [
            {
              json: {
                result: part.toolResponse.output as { [key: string]: any },
              },
            },
          ],
        },
      },
    ];
  }
  if (part.reasoning !== undefined) {
    return toAwsBedrockReasoning(part);
  }
  if (part.data !== undefined) {
    return [{ text: JSON.stringify(part.data) }];
  }
  // Parts Bedrock has no equivalent for (custom, resource, ...) are skipped.
  return [];
}

/**
 * Converts Genkit messages to Bedrock Converse messages.
 *
 * System messages are left out (see getSystemMessage). Tool messages become
 * user messages carrying toolResult blocks, and consecutive messages with the
 * same Bedrock role are merged, because Converse requires the conversation to
 * alternate and wants every result for a turn's tool calls in one message.
 */
export function toAwsBedrockMessages(
  messages: MessageData[],
  imageFormat: ImageFormat = 'png'
): AwsMessge[] {
  const awsBedrockMsgs: AwsMessge[] = [];
  for (const message of messages) {
    const role = toAwsBedrockRole(message.role);
    if (role === 'system') continue;

    const content = message.content.flatMap((part) => {
      const blocks = toContentBlocks(part, imageFormat);
      const cachePoint = cachePointFor(part);
      return cachePoint ? [...blocks, { cachePoint }] : blocks;
    });
    if (content.length === 0) continue;

    const last = awsBedrockMsgs[awsBedrockMsgs.length - 1];
    if (last && last.role === role) {
      last.content!.push(...content);
    } else {
      awsBedrockMsgs.push({ role, content });
    }
  }
  return awsBedrockMsgs;
}

/**
 * Turns system messages into a user/assistant exchange, for models that
 * don't accept a system prompt. Mirrors Genkit's simulateSystemPrompt.
 */
function simulateSystemPrompt(messages: MessageData[]): MessageData[] {
  const system = messages.filter((m) => m.role === 'system');
  if (system.length === 0) return messages;
  return [
    {
      role: 'user',
      content: [
        { text: 'SYSTEM INSTRUCTIONS:\n' },
        ...system.flatMap((m) => m.content),
      ],
    },
    { role: 'model', content: [{ text: 'Understood.' }] },
    ...messages.filter((m) => m.role !== 'system'),
  ];
}

const finishReasonMap: Record<string, ModelResponseData['finishReason']> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  tool_use: 'stop',
  max_tokens: 'length',
  model_context_window_exceeded: 'length',
  content_filtered: 'blocked',
  guardrail_intervened: 'blocked',
  malformed_model_output: 'other',
  malformed_tool_use: 'other',
};

/**
 * Maps a Bedrock stop reason to a Genkit finish reason.
 */
export function fromAwsBedrockStopReason(
  stopReason: string | undefined
): ModelResponseData['finishReason'] {
  if (!stopReason) return 'unknown';
  return finishReasonMap[stopReason] ?? 'other';
}

/**
 * Maps Bedrock token usage to Genkit usage, including prompt-cache reads.
 * Cache writes have no Genkit field, so they go in `custom`.
 */
export function fromAwsBedrockUsage(
  usage: TokenUsage | undefined
): GenerationUsage {
  const out: GenerationUsage = {
    inputTokens: usage?.inputTokens || 0,
    outputTokens: usage?.outputTokens || 0,
    totalTokens: usage?.totalTokens || 0,
  };
  if (usage?.cacheReadInputTokens) {
    out.cachedContentTokens = usage.cacheReadInputTokens;
  }
  if (usage?.cacheWriteInputTokens) {
    out.custom = { cacheWriteInputTokens: usage.cacheWriteInputTokens };
  }
  return out;
}

/** Stop reasons that mean the model's output was cut off. */
export const TRUNCATED_STOP_REASONS = new Set([
  'max_tokens',
  'model_context_window_exceeded',
]);

/**
 * Strictly parses the JSON in a final response: the whole text, or else the
 * span from the first `{` or `[` to the last `}` or `]`, which drops a code
 * fence or prose around it. Returns undefined when neither parses.
 */
function parseFinalJson(text: string): unknown {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

/**
 * Converts the model's final text in JSON mode to a data part, accepting
 * JSON wrapped in a code fence or surrounded by prose.
 *
 * Partial data is never returned as final output: when the model was cut
 * off (max_tokens) or the text isn't valid JSON, the text is returned as
 * is, with no data part, like Genkit's Anthropic and Google AI plugins. The
 * caller still sees what the model said; Genkit's own output parsing and
 * schema validation then apply, and finishReason says it was cut off.
 */
export function jsonOutputPart(text: string, stopReason?: string): Part {
  if (stopReason && TRUNCATED_STOP_REASONS.has(stopReason)) return { text };
  // Nothing came back (empty output, or a guardrail swallowed it): say so
  // rather than reporting a successful empty object.
  if (!text.trim()) return { text };
  const data = parseFinalJson(text);
  return data === undefined ? { text } : { data };
}

/**
 * Builds the final message content from the parts of a response. In JSON
 * mode, a response without tool calls has its text parsed into one data
 * part, after any reasoning (see jsonOutputPart for truncated output).
 */
export function finalContent(
  content: Part[],
  jsonMode: boolean,
  stopReason?: string
): Part[] {
  const hasToolRequests = content.some((p) => p.toolRequest);
  if (jsonMode && !hasToolRequests) {
    const reasoning = content.filter((p) => p.reasoning !== undefined);
    const text = content.map((p) => p.text ?? '').join('');
    return [...reasoning, jsonOutputPart(text, stopReason)];
  }
  return content.length > 0 ? content : [{ text: '' }];
}

/**
 * Converts a Converse response to a Genkit response.
 *
 * Reasoning, text and tool calls are kept in the order Bedrock returned
 * them. In JSON mode, a response without tool calls has its text parsed into
 * a data part.
 */
export function fromAwsBedrockChoice(
  choice: ConverseCommandOutput,
  jsonMode = false
): ModelResponseData {
  const content: Part[] = [];
  for (const block of choice.output?.message?.content ?? []) {
    if (block.text !== undefined) {
      content.push({ text: block.text });
    } else if (block.toolUse) {
      content.push({
        toolRequest: {
          name: block.toolUse.name!,
          ref: block.toolUse.toolUseId,
          input: block.toolUse.input,
        },
      });
    } else if (block.reasoningContent) {
      const part = fromAwsBedrockReasoning(block.reasoningContent);
      if (part) content.push(part);
    }
  }

  const message = finalContent(content, jsonMode, choice.stopReason);

  return {
    finishReason: fromAwsBedrockStopReason(choice.stopReason),
    message: { role: 'model', content: message },
    usage: fromAwsBedrockUsage(choice.usage),
    custom: {},
  };
}

const JSON_INSTRUCTION =
  'You write JSON objects based on the given instructions. Please generate only the JSON output. DO NOT provide any preamble.';

/**
 * Whether the request turns tools off: toolChoice "none" with no tool named
 * in config.toolChoice.
 */
function toolsDisabled(
  request: GenerateRequest<typeof AwsBedrockConfigSchema>
): boolean {
  return !request.config?.toolChoice && request.toolChoice === 'none';
}

/**
 * Rewrites the tool calls and results in a conversation as text.
 *
 * Converse has no "none" tool choice, and it rejects toolUse and toolResult
 * blocks unless tools are sent. Sending the tools would let the model call
 * them, so for toolChoice "none" the history's tool blocks become text and
 * no tools are sent: the model still sees what was called and returned, but
 * can't call anything.
 */
function toolBlocksToText(messages: AwsMessge[]): AwsMessge[] {
  return messages.map((m) => ({
    ...m,
    content: m.content?.map((block): ContentBlock => {
      if (block.toolUse) {
        const { name, toolUseId, input } = block.toolUse;
        return {
          text: `[Called tool ${name} (call ${toolUseId}) with input: ${JSON.stringify(input ?? {})}]`,
        };
      }
      if (block.toolResult) {
        const result = (block.toolResult.content ?? [])
          .map((c) => c.text ?? JSON.stringify(c.json ?? c))
          .join('\n');
        return {
          text: `[Result of tool call ${block.toolResult.toolUseId}: ${result}]`,
        };
      }
      return block;
    }),
  }));
}

/**
 * Whether a tool result (from the named tool, or from any tool when no name
 * is given) is in the history after the user's last text or media message,
 * i.e. a tool was already called this turn.
 */
function toolAnswered(messages: MessageData[], name?: string): boolean {
  let lastUserTurn = -1;
  messages.forEach((m, i) => {
    if (m.role === 'user' && m.content.some((p) => p.text || p.media)) {
      lastUserTurn = i;
    }
  });
  return messages
    .slice(lastUserTurn + 1)
    .some((m) =>
      m.content.some(
        (p) =>
          p.toolResponse && (name === undefined || p.toolResponse.name === name)
      )
    );
}

/**
 * Builds the Converse toolConfig from the request's tools and tool choice.
 *
 * Genkit's toolChoice maps onto Converse as auto -> auto and required -> any.
 * config.toolChoice names one tool the model must call. Both forced choices
 * hold only until a tool result (the named tool's, for a named choice) is in
 * the history after the user's last message; from then on the choice is
 * auto, so Genkit's tool loop can finish. Models that don't declare
 * supports.toolChoice get no toolChoice (Bedrock's default is auto). Converse has no "none"
 * choice, so toolChoice "none" leaves the tools out (see toolsDisabled).
 */
function toAwsBedrockToolConfig(
  request: GenerateRequest<typeof AwsBedrockConfigSchema>,
  modelSupportsTools: boolean,
  modelSupportsToolChoice: boolean
): ToolConfiguration | undefined {
  const tools = request.tools ?? [];
  if (!modelSupportsTools || tools.length === 0) return undefined;

  const named = request.config?.toolChoice;
  if (toolsDisabled(request)) return undefined;

  let toolChoice: ToolChoice | undefined;
  if (named) {
    if (!tools.some((t) => t.name === named)) {
      throw new GenkitError({
        status: 'INVALID_ARGUMENT',
        message: `toolChoice "${named}" does not match any of the request's tools (${tools.map((t) => t.name).join(', ')}).`,
      });
    }
    // Genkit's tool loop resends the same config after running the tool, so
    // forcing the tool every turn would loop until Genkit gives up. Once
    // the named tool has answered since the user's last message, the model
    // is left to answer (auto).
    toolChoice = toolAnswered(request.messages, named)
      ? { auto: {} }
      : { tool: { name: named } };
  } else if (request.toolChoice === 'required') {
    // Same rule as a named tool: Genkit resends toolChoice after each tool
    // result, and forcing a call every turn would never let the loop end.
    toolChoice = toolAnswered(request.messages) ? { auto: {} } : { any: {} };
  } else if (request.toolChoice === 'auto') {
    toolChoice = { auto: {} };
  }

  // Not every Bedrock model accepts a forced choice (any/tool). Auto is the
  // default, so models without toolChoice support get no toolChoice at all.
  return {
    tools: tools.map(toAwsBedrockTool),
    toolChoice: modelSupportsToolChoice ? toolChoice : undefined,
  };
}

export function toAwsBedrockRequestBody(
  modelName: string,
  request: GenerateRequest<typeof AwsBedrockConfigSchema>,
  inferenceRegion: string
) {
  const model = SUPPORTED_AWS_BEDROCK_MODELS(inferenceRegion)[modelName] || {
    info: {
      supports: {
        output: ['text', 'json'],
        systemRole: true,
        tools: true,
      },
    },
  };
  const systemRole = model.info.supports?.systemRole === true;
  const jsonMode =
    request.output?.format === 'json' ||
    request.output?.contentType === 'application/json';

  // The JSON instruction joins the system prompt, so models without a
  // system role get it too, inside the simulated system prompt.
  let requestMessages = request.messages;
  if (jsonMode && model.info.supports?.output?.includes('json')) {
    requestMessages = [
      ...requestMessages,
      { role: 'system', content: [{ text: JSON_INSTRUCTION }] },
    ];
  }

  const messages = systemRole
    ? requestMessages
    : simulateSystemPrompt(requestMessages);
  let awsBedrockMessages = toAwsBedrockMessages(messages);
  if (toolsDisabled(request)) {
    awsBedrockMessages = toolBlocksToText(awsBedrockMessages);
  }

  const awsBedrockSystemMessage = systemRole
    ? getSystemMessage(requestMessages) || []
    : [];

  const config: AwsBedrockConfig = request.config ?? {};
  const modelString = (request.config?.version ||
    model.version ||
    modelName) as string;

  const body: ConverseCommandInput | ConverseStreamCommandInput = {
    messages: awsBedrockMessages,
    system:
      awsBedrockSystemMessage.length > 0 ? awsBedrockSystemMessage : undefined,
    toolConfig: toAwsBedrockToolConfig(
      request,
      model.info.supports.tools === true,
      model.info.supports.toolChoice === true
    ),
    modelId: modelString,
    outputConfig:
      jsonMode && request.output?.schema
        ? {
            textFormat: {
              type: OutputFormatType.JSON_SCHEMA,
              structure: {
                jsonSchema: {
                  schema: JSON.stringify(request.output.schema),
                },
              },
            },
          }
        : undefined,
    inferenceConfig: {
      maxTokens: request.config?.maxOutputTokens,
      temperature: request.config?.temperature,
      topP: request.config?.topP,
      //n: request.candidates,
      stopSequences: request.config?.stopSequences,
    },
    additionalModelRequestFields: config.additionalModelRequestFields,
    additionalModelResponseFieldPaths: config.additionalModelResponseFieldPaths,
    guardrailConfig: config.guardrailConfig,
    performanceConfig: config.performanceConfig,
    serviceTier: config.serviceTier ? { type: config.serviceTier } : undefined,
    requestMetadata: config.requestMetadata,
  };

  return body;
}
