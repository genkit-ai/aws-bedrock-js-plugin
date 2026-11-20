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
  ContentBlock,
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  DocumentFormat,
  ImageFormat,
  OutputFormatType,
  SystemContentBlock,
  Tool,
  ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';
import {
  GenerateRequest,
  GenerationCommonConfigSchema,
  Message,
  MessageData,
  Part,
  Role,
  ToolRequestPart,
} from 'genkit';
import { ModelResponseData, ToolDefinition } from 'genkit/model';

import { SUPPORTED_AWS_BEDROCK_MODELS } from './models.js';

function toAwsBedrockbRole(role: Role): string {
  switch (role) {
    case 'user':
      return 'user';
    case 'model':
      return 'assistant';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
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
const regex = /data:.*base64,/;
const getDataPart = (dataUrl: string) => dataUrl.replace(regex, '');

/**
 * Extracts the content type from a data URL.
 * @param url The data URL to parse.
 * @returns The content type, or null if invalid.
 */
function extractContentTypeFromDataUrl(url: string): string | null {
  const match = url.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}

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
 * Checks if a content type is an image type.
 * @param contentType The content type to check.
 * @returns True if the content type is an image type.
 */
function isImageContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/');
}

/**
 * Gets the Bedrock document format from a MIME type.
 * @param contentType The MIME type.
 * @returns The Bedrock document format, or undefined if not supported.
 */
function getDocumentFormat(contentType: string): DocumentFormat | undefined {
  return MIME_TO_DOCUMENT_FORMAT[contentType];
}

/**
 * Generates a unique filename from a document format.
 * AWS Bedrock document names can only contain alphanumeric characters,
 * whitespace, hyphens, parentheses, and square brackets (no dots/periods).
 * @param format The document format.
 * @returns A valid unique document name.
 */
function generateFilenameFromFormat(format: DocumentFormat): string {
  return `document-${format}-${Math.random().toString(36).slice(2)}`;
}

export function toAwsBedrockTextAndMedia(
  part: Part,
  imageFormat: ImageFormat
): ContentBlock {
  if (part.text) {
    return {
      text: part.text,
    };
  } else if (part.media) {
    // Determine the content type from the media part or data URL
    let contentType = part.media.contentType;
    if (!contentType && part.media.url.startsWith('data:')) {
      contentType = extractContentTypeFromDataUrl(part.media.url) || undefined;
    }

    const dataBuffer = new Uint8Array(
      Buffer.from(getDataPart(part.media.url), 'base64')
    );

    // Handle media based on content type
    if (contentType) {
      const docFormat = getDocumentFormat(contentType);
      if (docFormat) {
        return {
          document: {
            name: generateFilenameFromFormat(docFormat),
            format: docFormat,
            source: { bytes: dataBuffer },
          },
        };
      }

      if (isImageContentType(contentType)) {
        return {
          image: {
            source: { bytes: dataBuffer },
            format: imageFormat,
          },
        };
      }

      // For unsupported content types, throw an error
      throw Error(
        `Unsupported media content type: ${contentType}. Supported types are images and documents (pdf, csv, txt, html, md, doc, docx, xls, xlsx).`
      );
    }

    // Default to image when no contentType is provided (preserve legacy behavior)
    return {
      image: {
        source: { bytes: dataBuffer },
        format: imageFormat,
      },
    };
  }
  throw Error(
    `Unsupported genkit part fields encountered for current message role: ${part}.`
  );
}

export function getSystemMessage(
  messages: MessageData[]
): SystemContentBlock[] | null {
  for (const message of messages) {
    if (message.role === 'system') {
      return [
        {
          text: message.content[0].text!,
        },
      ];
    }
  }
  return null;
}

export function toAwsBedrockMessages(
  messages: MessageData[],
  imageFormat: ImageFormat = 'png'
): AwsMessge[] {
  const awsBedrockMsgs: AwsMessge[] = [];
  for (const message of messages) {
    const msg = new Message(message);
    const role = toAwsBedrockbRole(message.role);
    switch (role) {
      case 'system': {
        break;
      }
      case 'user': {
        const textAndMedia = msg.content.map((part) =>
          toAwsBedrockTextAndMedia(part, imageFormat)
        );
        if (textAndMedia.length > 1) {
          awsBedrockMsgs.push({
            role: role,
            content: textAndMedia,
          });
        } else {
          awsBedrockMsgs.push({
            role: role,
            content: [
              {
                text: msg.text,
              },
            ],
          });
        }
        break;
      }
      case 'assistant': {
        // Request to call the tool

        const toolCalls: ToolUseBlock[] = msg.content
          .filter((part) => part.toolRequest)
          .map((part) => {
            if (!part.toolRequest) {
              throw Error(
                'Mapping genkit message to openai tool call content part but message.toolRequest not provided.'
              );
            }
            return {
              toolUseId: part.toolRequest.ref || '',
              name: part.toolRequest.name,
              input: part.toolRequest.input as any,
            };
          });
        if (toolCalls?.length > 0) {
          awsBedrockMsgs.push({
            role: role,
            content: toolCalls.map((toolCall) => ({ toolUse: toolCall })),
          });
        } else {
          awsBedrockMsgs.push({
            role: role,
            content: [
              {
                text:
                  msg.data !== undefined && !msg.text
                    ? JSON.stringify(msg.data)
                    : msg.text,
              },
            ],
          });
        }
        break;
      }
      case 'tool': {
        // result of the tool
        const toolResponseParts = msg.toolResponseParts();

        toolResponseParts.map((part) => {
          const toolresult: AwsMessge = {
            role: 'user',
            content: [
              {
                toolResult: {
                  toolUseId: part.toolResponse.ref,
                  content: [
                    {
                      json: {
                        result: part.toolResponse.output as {
                          [key: string]: any;
                        },
                      },
                    },
                  ],
                },
              },
            ],
          };
          awsBedrockMsgs.push(toolresult);
        });
        break;
      }
      default:
        throw new Error('unrecognized role');
    }
  }
  return awsBedrockMsgs;
}

const finishReasonMap: Record<
  NonNullable<string>,
  ModelResponseData['finishReason']
> = {
  max_tokens: 'length',
  end_turn: 'stop',
  stop_sequence: 'stop',
  tool_use: 'stop',
  content_filtered: 'blocked',
  guardrail_intervened: 'blocked',
};

function fromAwsBedrockToolCall(toolCall: ToolUseBlock) {
  if (!('toolUseId' in toolCall)) {
    throw Error(
      `Unexpected AWS chunk choice. tool_calls was provided but one or more tool_calls is missing.`
    );
  }
  const f = toolCall;
  return [
    {
      toolRequest: {
        name: f.name,
        ref: toolCall.toolUseId,
        input: f.input,
      },
    },
  ];
}

function extractTextFromContent(content: ContentBlock[] | undefined): string {
  if (!content) return '';

  // Find the content block that contains text (skip reasoningContent blocks)
  for (const block of content) {
    if ('text' in block && block.text) {
      return block.text;
    }
  }
  return '';
}

export function fromAwsBedrockChoice(
  choice: ConverseCommandOutput,
  jsonMode = false
): ModelResponseData {
  // Find all tool use blocks in the content array
  const toolRequestParts: any[] = [];
  if (choice.output?.message?.content) {
    for (const contentBlock of choice.output.message.content) {
      if (contentBlock.toolUse) {
        toolRequestParts.push(...fromAwsBedrockToolCall(contentBlock.toolUse));
      }
    }
  }

  const textContent = extractTextFromContent(choice.output?.message?.content);

  return {
    finishReason:
      'stopReason' in choice ? finishReasonMap[choice.stopReason!] : 'other',
    message: {
      role: 'model',
      content:
        Array.isArray(toolRequestParts) && toolRequestParts.length > 0
          ? (toolRequestParts as ToolRequestPart[])
          : [
              jsonMode
                ? {
                    data: textContent ? JSON.parse(textContent) : {},
                  }
                : { text: textContent },
            ],
    },
    custom: {},
  };
}

export function toAwsBedrockRequestBody(
  modelName: string,
  request: GenerateRequest<typeof GenerationCommonConfigSchema>,
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
  const awsBedrockMessages = toAwsBedrockMessages(request.messages);

  const awsBedrockSystemMessage = getSystemMessage(request.messages) || [];

  const jsonMode =
    request.output?.format === 'json' ||
    request.output?.contentType === 'application/json';

  const textMode =
    request.output?.format === 'text' ||
    request.output?.contentType === 'plain/text';

  const response_format = request.output?.format
    ? request.output?.format
    : request.output?.contentType;
  if (jsonMode && model.info.supports?.output?.includes('json')) {
    awsBedrockSystemMessage?.push({
      text: 'You write JSON objects based on the given instructions. Please generate only the JSON output. DO NOT provide any preamble.',
    });
  } else if (
    (textMode && model.info.supports?.output?.includes('text')) ||
    model.info.supports?.output?.includes('text')
  ) {
    awsBedrockSystemMessage?.push({
      text: 'You write objects in plain text. DO NOT provide any preamble.',
    });
  } else {
    throw new Error(
      `${response_format} format is not supported for GPT models currently`
    );
  }
  const modelString = (request.config?.version ||
    model.version ||
    modelName) as string;

  const body: ConverseCommandInput | ConverseStreamCommandInput = {
    messages: awsBedrockMessages,
    system:
      model.info.supports.systemRole === true
        ? (awsBedrockSystemMessage as SystemContentBlock[])
        : [],
    toolConfig:
      request.tools &&
      model.info.supports.tools === true &&
      request.tools.length > 0
        ? { tools: request.tools.map(toAwsBedrockTool) }
        : undefined,
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
  };

  return body;
}
