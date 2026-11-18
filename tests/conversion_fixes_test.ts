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

import { GenkitError } from 'genkit';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fromAwsBedrockChoice,
  fromAwsBedrockStopReason,
  toAwsBedrockMessages,
  toAwsBedrockRequestBody,
  toAwsBedrockTextAndMedia,
} from '../src/converse.js';
import { toGenkitError } from '../src/errors.js';
import { awsBedrockModel } from '../src/generate.js';
import { fakeClient } from './mocks/bedrock-client.js';

const b64 = (bytes: number[]) => Buffer.from(bytes).toString('base64');
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0];

describe('tool results', () => {
  it('sends parallel tool results in one user message (#664)', () => {
    const out = toAwsBedrockMessages([
      { role: 'user', content: [{ text: 'weather in Paris and Rome?' }] },
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
          {
            toolRequest: {
              name: 'weather',
              ref: 't2',
              input: { city: 'Rome' },
            },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          { toolResponse: { name: 'weather', ref: 't1', output: 'sunny' } },
          { toolResponse: { name: 'weather', ref: 't2', output: 'rainy' } },
        ],
      },
    ]);
    assert.deepEqual(
      out.map((m) => m.role),
      ['user', 'assistant', 'user']
    );
    assert.deepEqual(
      out[2].content!.map((c) => c.toolResult?.toolUseId),
      ['t1', 't2']
    );
  });

  it('merges tool results sent as separate tool messages', () => {
    const out = toAwsBedrockMessages([
      {
        role: 'tool',
        content: [{ toolResponse: { name: 'a', ref: 't1', output: 1 } }],
      },
      {
        role: 'tool',
        content: [{ toolResponse: { name: 'b', ref: 't2', output: 2 } }],
      },
      { role: 'user', content: [{ text: 'and now?' }] },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].role, 'user');
    assert.deepEqual(
      out[0].content!.map((c) => Object.keys(c)[0]),
      ['toolResult', 'toolResult', 'text']
    );
  });
});

describe('message conversion', () => {
  it('keeps a lone image in a user message', () => {
    const [msg] = toAwsBedrockMessages([
      {
        role: 'user',
        content: [
          {
            media: {
              url: `data:image/png;base64,${b64([0x89, 0x50, 0x4e, 0x47])}`,
            },
          },
        ],
      },
    ]);
    assert.equal(msg.content!.length, 1);
    assert.equal(msg.content![0].image?.format, 'png');
  });

  it('keeps the text that comes with tool calls', () => {
    const [msg] = toAwsBedrockMessages([
      {
        role: 'model',
        content: [
          { text: 'Let me check.' },
          { toolRequest: { name: 'weather', ref: 't1', input: {} } },
        ],
      },
    ]);
    assert.deepEqual(msg.content, [
      { text: 'Let me check.' },
      { toolUse: { toolUseId: 't1', name: 'weather', input: {} } },
    ]);
  });

  it('sends data parts as JSON text and drops blank text', () => {
    const [msg] = toAwsBedrockMessages([
      { role: 'model', content: [{ text: '' }, { data: { n: 1 } }] },
    ]);
    assert.deepEqual(msg.content, [{ text: '{"n":1}' }]);
  });
});

describe('media', () => {
  const media = (url: string, contentType?: string) =>
    toAwsBedrockTextAndMedia({ media: { url, contentType } });

  it('uses the image format from the content type', () => {
    assert.equal(
      media(`data:image/jpeg;base64,${b64(JPEG_BYTES)}`).image?.format,
      'jpeg'
    );
    assert.equal(media('data:image/webp;base64,AAAA').image?.format, 'webp');
    assert.equal(media('AAAA', 'image/gif').image?.format, 'gif');
  });

  it('sniffs the image format when there is no content type', () => {
    assert.equal(media(b64(JPEG_BYTES)).image?.format, 'jpeg');
  });

  it('names a document after its content, so cache points still match', () => {
    const pdf = 'data:application/pdf;base64,JVBERi0xLjQ=';
    const name = media(pdf).document?.name;
    assert.match(name ?? '', /^document-pdf-[0-9a-f]{16}$/);
    assert.equal(media(pdf).document?.name, name);
    assert.notEqual(
      media('data:application/pdf;base64,JVBERi0xLjU=').document?.name,
      name
    );
    const s3 = media('s3://bucket/a.pdf', 'application/pdf').document?.name;
    assert.equal(
      media('s3://bucket/a.pdf', 'application/pdf').document?.name,
      s3
    );
  });

  it('sends videos as video blocks', () => {
    assert.equal(media('data:video/mp4;base64,AAAA').video?.format, 'mp4');
  });

  it('passes s3:// URIs as S3 locations', () => {
    const block = media('s3://bucket/cat.png', 'image/png');
    assert.deepEqual(block.image?.source, {
      s3Location: { uri: 's3://bucket/cat.png' },
    });
  });

  it('rejects remote URLs', () => {
    assert.throws(
      () => media('https://example.com/cat.png', 'image/png'),
      /does not fetch remote media/
    );
  });

  it("rejects data URLs that aren't base64", () => {
    assert.throws(
      () => media('data:text/plain,hello'),
      /must be base64-encoded/
    );
  });

  it('rejects unknown image types', () => {
    assert.throws(
      () => media('AAAA', 'image/bmp'),
      /Unsupported media content type: image\/bmp/
    );
  });
});

describe('system prompt', () => {
  const user = { role: 'user' as const, content: [{ text: 'hi' }] };

  it('sends every system message and part', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        messages: [
          { role: 'system', content: [{ text: 'one' }, { text: 'two' }] },
          { role: 'system', content: [{ text: 'three' }] },
          user,
        ],
      },
      'us'
    );
    assert.deepEqual(body.system, [
      { text: 'one' },
      { text: 'two' },
      { text: 'three' },
    ]);
  });

  it('adds no instructions of its own outside JSON mode', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      { messages: [user] },
      'us'
    );
    assert.equal(body.system, undefined);
  });

  it('still asks for JSON in JSON mode', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      { messages: [user], output: { format: 'json' } },
      'us'
    );
    assert.match(body.system![0].text!, /JSON/);
  });

  it('simulates the system prompt for models without a system role', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.titan-text-express-v1',
      { messages: [{ role: 'system', content: [{ text: 'be brief' }] }, user] },
      'us'
    );
    assert.equal(body.system, undefined);
    assert.deepEqual(body.messages, [
      {
        role: 'user',
        content: [{ text: 'SYSTEM INSTRUCTIONS:\n' }, { text: 'be brief' }],
      },
      { role: 'assistant', content: [{ text: 'Understood.' }] },
      { role: 'user', content: [{ text: 'hi' }] },
    ]);
  });

  it('asks for JSON in the simulated system prompt too', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.titan-text-express-v1',
      { messages: [user], output: { format: 'json' } },
      'us'
    );
    assert.equal(body.system, undefined);
    assert.match(body.messages![0].content![1].text!, /JSON/);
  });
});

describe('response conversion', () => {
  it('keeps every text block and tool call in order', () => {
    const res = fromAwsBedrockChoice({
      output: {
        message: {
          role: 'assistant',
          content: [
            { text: 'Checking ' },
            { text: 'now.' },
            {
              toolUse: {
                toolUseId: 't1',
                name: 'weather',
                input: { city: 'Paris' },
              },
            },
          ],
        },
      },
      stopReason: 'tool_use',
      $metadata: {},
    } as any);
    assert.deepEqual(res.message?.content, [
      { text: 'Checking ' },
      { text: 'now.' },
      { toolRequest: { name: 'weather', ref: 't1', input: { city: 'Paris' } } },
    ]);
    assert.equal(res.finishReason, 'stop');
  });

  it('maps every stop reason', () => {
    assert.equal(fromAwsBedrockStopReason('end_turn'), 'stop');
    assert.equal(fromAwsBedrockStopReason('tool_use'), 'stop');
    assert.equal(fromAwsBedrockStopReason('max_tokens'), 'length');
    assert.equal(
      fromAwsBedrockStopReason('model_context_window_exceeded'),
      'length'
    );
    assert.equal(fromAwsBedrockStopReason('guardrail_intervened'), 'blocked');
    assert.equal(fromAwsBedrockStopReason('malformed_tool_use'), 'other');
    assert.equal(fromAwsBedrockStopReason('something_new'), 'other');
    assert.equal(fromAwsBedrockStopReason(undefined), 'unknown');
  });

  it('reports prompt-cache usage', () => {
    const res = fromAwsBedrockChoice({
      output: { message: { role: 'assistant', content: [{ text: 'hi' }] } },
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
        cacheReadInputTokens: 8,
        cacheWriteInputTokens: 4,
      },
    } as any);
    assert.deepEqual(res.usage, {
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
      cachedContentTokens: 8,
      custom: { cacheWriteInputTokens: 4 },
    });
  });

  it('parses fenced JSON in JSON mode', () => {
    const res = fromAwsBedrockChoice(
      {
        output: {
          message: {
            role: 'assistant',
            content: [{ text: '```json\n{"n": 1}\n```' }],
          },
        },
      } as any,
      true
    );
    assert.deepEqual(res.message?.content, [{ data: { n: 1 } }]);
  });

  it('returns non-JSON text as text in JSON mode instead of throwing', () => {
    const res = fromAwsBedrockChoice(
      {
        output: {
          message: { role: 'assistant', content: [{ text: 'sorry, no' }] },
        },
      } as any,
      true
    );
    assert.deepEqual(res.message?.content, [{ text: 'sorry, no' }]);
  });

  const jsonReply = (text: string, stopReason?: string) =>
    fromAwsBedrockChoice(
      {
        stopReason,
        output: { message: { role: 'assistant', content: [{ text }] } },
      } as any,
      true
    );

  it('parses JSON surrounded by prose', () => {
    assert.deepEqual(
      jsonReply('Here you go: {"n": [1, 2]} Enjoy.').message?.content,
      [{ data: { n: [1, 2] } }]
    );
  });

  it('returns truncated JSON as text, not partial data', () => {
    const res = jsonReply('{"a": 1, "b": "unfini', 'max_tokens');
    assert.equal(res.finishReason, 'length');
    assert.deepEqual(res.message?.content, [{ text: '{"a": 1, "b": "unfini' }]);
  });

  it('returns cut-off JSON as text even when it happens to parse', () => {
    const res = jsonReply('{"items": [1]}', 'max_tokens');
    assert.deepEqual(res.message?.content, [{ text: '{"items": [1]}' }]);
  });

  it('returns malformed JSON as text instead of throwing', () => {
    const res = jsonReply('{"a": 1,, }', 'end_turn');
    assert.deepEqual(res.message?.content, [{ text: '{"a": 1,, }' }]);
  });

  it('does not complete unterminated JSON', () => {
    const res = jsonReply('{"a": [1, 2', 'end_turn');
    assert.deepEqual(res.message?.content, [{ text: '{"a": [1, 2' }]);
  });
});

describe('errors', () => {
  const awsError = (name: string) => Object.assign(new Error('nope'), { name });

  it('maps Bedrock exceptions to Genkit statuses', () => {
    const err = toGenkitError(awsError('ThrottlingException')) as GenkitError;
    assert.ok(err instanceof GenkitError);
    assert.equal(err.status, 'RESOURCE_EXHAUSTED');
    assert.match(err.message, /ThrottlingException: nope/);
    assert.equal((err as any).cause.name, 'ThrottlingException');
    assert.equal(
      (toGenkitError(awsError('ValidationException')) as GenkitError).status,
      'INVALID_ARGUMENT'
    );
    assert.equal(
      (toGenkitError(awsError('AccessDeniedException')) as GenkitError).status,
      'PERMISSION_DENIED'
    );
  });

  it('leaves other errors alone', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    assert.equal(toGenkitError(abort), abort);
  });

  it('returns the finish reason and mapped errors from the model', async () => {
    const ok = fakeClient(() => ({
      output: { message: { role: 'assistant', content: [{ text: 'cut' }] } },
      stopReason: 'max_tokens',
    }));
    const res = await awsBedrockModel(
      'amazon.nova-lite-v1:0',
      ok.client,
      'us'
    )({
      messages: [{ role: 'user', content: [{ text: 'hi' }] }],
    });
    assert.equal(res.finishReason, 'length');

    const failing = fakeClient(() => {
      throw awsError('ValidationException');
    });
    await assert.rejects(
      awsBedrockModel(
        'amazon.nova-lite-v1:0',
        failing.client,
        'us'
      )({
        messages: [{ role: 'user', content: [{ text: 'hi' }] }],
      }),
      (e: any) => e.status === 'INVALID_ARGUMENT'
    );
  });
});
