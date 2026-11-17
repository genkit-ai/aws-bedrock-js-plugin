/**
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
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { GenerateRequest } from 'genkit';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getSystemMessage,
  toAwsBedrockMessages,
  toAwsBedrockRequestBody,
  toAwsBedrockTextAndMedia,
} from '../src/converse.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const PDF = 'data:application/pdf;base64,JVBERi0=';

describe('toAwsBedrockMessages', () => {
  it('skips system messages', () => {
    const out = toAwsBedrockMessages([
      { role: 'system', content: [{ text: 'be brief' }] },
      { role: 'user', content: [{ text: 'hi' }] },
    ]);
    assert.deepEqual(out, [{ role: 'user', content: [{ text: 'hi' }] }]);
  });

  it('converts user text and media', () => {
    const [msg] = toAwsBedrockMessages([
      {
        role: 'user',
        content: [{ text: 'what is this?' }, { media: { url: PNG } }],
      },
    ]);
    assert.equal(msg.role, 'user');
    assert.deepEqual(msg.content![0], { text: 'what is this?' });
    assert.equal(msg.content![1].image?.format, 'png');
    assert.ok(msg.content![1].image?.source?.bytes instanceof Uint8Array);
  });

  it('converts assistant text', () => {
    const out = toAwsBedrockMessages([
      { role: 'model', content: [{ text: 'hello' }] },
    ]);
    assert.deepEqual(out, [
      { role: 'assistant', content: [{ text: 'hello' }] },
    ]);
  });

  it('converts assistant tool requests to toolUse blocks', () => {
    const out = toAwsBedrockMessages([
      {
        role: 'model',
        content: [
          {
            toolRequest: {
              name: 'weather',
              ref: 't1',
              input: { city: 'Paris' },
            },
          },
        ],
      },
    ]);
    assert.deepEqual(out, [
      {
        role: 'assistant',
        content: [
          {
            toolUse: {
              toolUseId: 't1',
              name: 'weather',
              input: { city: 'Paris' },
            },
          },
        ],
      },
    ]);
  });

  it('converts a tool response to a toolResult', () => {
    const out = toAwsBedrockMessages([
      {
        role: 'tool',
        content: [
          { toolResponse: { name: 'weather', ref: 't1', output: 'sunny' } },
        ],
      },
    ]);
    assert.deepEqual(out, [
      {
        role: 'user',
        content: [
          {
            toolResult: {
              toolUseId: 't1',
              content: [{ json: { result: 'sunny' } }],
            },
          },
        ],
      },
    ]);
  });
});

describe('toAwsBedrockTextAndMedia', () => {
  it('sends documents as document blocks', () => {
    const block = toAwsBedrockTextAndMedia({ media: { url: PDF } }, 'png');
    assert.equal(block.document?.format, 'pdf');
    assert.match(block.document!.name!, /^document-pdf-[a-z0-9]+$/);
  });

  it('rejects unsupported media types', () => {
    assert.throws(
      () =>
        toAwsBedrockTextAndMedia(
          {
            media: {
              url: 'data:audio/wav;base64,AAAA',
              contentType: 'audio/wav',
            },
          },
          'png'
        ),
      /Unsupported media content type: audio\/wav/
    );
  });
});

describe('getSystemMessage', () => {
  it('returns the system text', () => {
    assert.deepEqual(
      getSystemMessage([{ role: 'system', content: [{ text: 'be brief' }] }]),
      [{ text: 'be brief' }]
    );
  });

  it('returns null without a system message', () => {
    assert.equal(
      getSystemMessage([{ role: 'user', content: [{ text: 'hi' }] }]),
      null
    );
  });
});

describe('toAwsBedrockRequestBody', () => {
  const base: GenerateRequest<any> = {
    messages: [{ role: 'user', content: [{ text: 'hi' }] }],
  };

  it('maps the common config to inferenceConfig', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        ...base,
        config: {
          maxOutputTokens: 100,
          temperature: 0.5,
          topP: 0.9,
          stopSequences: ['END'],
        },
      },
      'us'
    );
    assert.equal(body.modelId, 'amazon.nova-lite-v1:0');
    assert.deepEqual(body.inferenceConfig, {
      maxTokens: 100,
      temperature: 0.5,
      topP: 0.9,
      stopSequences: ['END'],
    });
  });

  it('maps tools, including MCP inputJsonSchema', () => {
    const schema = { type: 'object', properties: { city: { type: 'string' } } };
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        ...base,
        tools: [
          { name: 'a', description: 'A', inputSchema: schema },
          { name: 'b', description: 'B', inputJsonSchema: schema } as any,
        ],
      },
      'us'
    );
    assert.deepEqual(body.toolConfig?.tools, [
      {
        toolSpec: {
          name: 'a',
          description: 'A',
          inputSchema: { json: schema },
        },
      },
      {
        toolSpec: {
          name: 'b',
          description: 'B',
          inputSchema: { json: schema },
        },
      },
    ]);
  });

  it('leaves tools out for models without tool support', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.titan-text-express-v1',
      { ...base, tools: [{ name: 'a', description: 'A' }] },
      'us'
    );
    assert.equal(body.toolConfig, undefined);
  });

  it('sends a JSON schema as outputConfig in JSON mode', () => {
    const schema = { type: 'object', properties: { n: { type: 'number' } } };
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      { ...base, output: { format: 'json', schema } },
      'us'
    );
    assert.deepEqual(body.outputConfig, {
      textFormat: {
        type: 'json_schema',
        structure: { jsonSchema: { schema: JSON.stringify(schema) } },
      },
    });
  });

  it('sends the system prompt for models with a system role', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        messages: [
          { role: 'system', content: [{ text: 'be brief' }] },
          ...base.messages,
        ],
      },
      'us'
    );
    assert.deepEqual(body.system?.[0], { text: 'be brief' });
  });

  it('sends the inference profile ID for prefixed models', () => {
    const body = toAwsBedrockRequestBody('eu.amazon.nova-pro-v1:0', base, 'eu');
    assert.equal(body.modelId, 'eu.amazon.nova-pro-v1:0');
  });
});
