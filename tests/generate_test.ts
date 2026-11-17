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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awsBedrockModel } from '../src/generate.js';
import { fakeClient, streamOf } from './mocks/bedrock-client.js';

const request = {
  messages: [{ role: 'user' as const, content: [{ text: 'hi' }] }],
};

describe('awsBedrockModel', () => {
  it('returns text and usage from Converse', async () => {
    const { client, sent } = fakeClient(() => ({
      output: { message: { role: 'assistant', content: [{ text: 'hello' }] } },
      stopReason: 'end_turn',
      usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
    }));
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    const res = await model(request);

    assert.equal(sent[0].name, 'ConverseCommand');
    assert.equal(sent[0].input.modelId, 'amazon.nova-lite-v1:0');
    assert.deepEqual(res.message?.content, [{ text: 'hello' }]);
    assert.deepEqual(res.usage, {
      inputTokens: 3,
      outputTokens: 1,
      totalTokens: 4,
    });
  });

  it('returns tool requests from Converse', async () => {
    const { client } = fakeClient(() => ({
      output: {
        message: {
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
      },
      stopReason: 'tool_use',
    }));
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    const res = await model(request);

    assert.deepEqual(res.message?.content, [
      { toolRequest: { name: 'weather', ref: 't1', input: { city: 'Paris' } } },
    ]);
  });

  it('parses JSON output in JSON mode', async () => {
    const { client } = fakeClient(() => ({
      output: {
        message: { role: 'assistant', content: [{ text: '{"n":1}' }] },
      },
      stopReason: 'end_turn',
    }));
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    const res = await model({ ...request, output: { format: 'json' } });

    assert.deepEqual(res.message?.content, [{ data: { n: 1 } }]);
  });

  it('streams text and returns the joined message', async () => {
    const { client, sent } = fakeClient(() =>
      streamOf([
        { messageStart: { role: 'assistant' } },
        { contentBlockDelta: { contentBlockIndex: 0, delta: { text: 'Hel' } } },
        { contentBlockDelta: { contentBlockIndex: 0, delta: { text: 'lo' } } },
        { contentBlockStop: { contentBlockIndex: 0 } },
        { messageStop: { stopReason: 'end_turn' } },
        {
          metadata: {
            usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          },
        },
      ])
    );
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    const chunks: string[] = [];
    const res = await model(request, {
      onChunk: (c) => chunks.push(c.content.map((p) => p.text ?? '').join('')),
    });

    assert.equal(sent[0].name, 'ConverseStreamCommand');
    assert.deepEqual(chunks.filter(Boolean), ['Hel', 'lo']);
    assert.deepEqual(res.message?.content, [{ text: 'Hello' }]);
    assert.deepEqual(res.usage, {
      inputTokens: 3,
      outputTokens: 2,
      totalTokens: 5,
    });
  });

  it('reassembles a streamed tool call', async () => {
    const { client } = fakeClient(() =>
      streamOf([
        {
          contentBlockStart: {
            contentBlockIndex: 0,
            start: { toolUse: { toolUseId: 't1', name: 'weather' } },
          },
        },
        {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '{"city":' } },
          },
        },
        {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { toolUse: { input: '"Paris"}' } },
          },
        },
        { contentBlockStop: { contentBlockIndex: 0 } },
        { messageStop: { stopReason: 'tool_use' } },
      ])
    );
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    const res = await model(request, { onChunk: () => {} });

    assert.deepEqual(res.message?.content, [
      { toolRequest: { name: 'weather', ref: 't1', input: { city: 'Paris' } } },
    ]);
  });
});
