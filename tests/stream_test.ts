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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awsBedrockModel } from '../src/generate.js';
import { fakeClient, streamOf } from './mocks/bedrock-client.js';

const request = {
  messages: [{ role: 'user' as const, content: [{ text: 'hi' }] }],
};

async function run(
  events: unknown[],
  extra: Record<string, unknown> = {},
  onChunk: (chunk: any) => void = () => {}
) {
  const { client } = fakeClient(() => streamOf(events));
  return awsBedrockModel(
    'amazon.nova-lite-v1:0',
    client,
    'us'
  )({ ...request, ...extra }, { onChunk });
}

const textDelta = (index: number, text: string) => ({
  contentBlockDelta: { contentBlockIndex: index, delta: { text } },
});
const toolStart = (index: number, id: string, name: string) => ({
  contentBlockStart: {
    contentBlockIndex: index,
    start: { toolUse: { toolUseId: id, name } },
  },
});
const toolDelta = (index: number, input: string) => ({
  contentBlockDelta: {
    contentBlockIndex: index,
    delta: { toolUse: { input } },
  },
});
const stop = (index: number) => ({
  contentBlockStop: { contentBlockIndex: index },
});

describe('stream reassembly', () => {
  it('keeps text and tool calls in block order and emits each tool once complete', async () => {
    const chunks: any[] = [];
    const res = await run(
      [
        textDelta(0, 'Checking '),
        textDelta(0, 'both.'),
        stop(0),
        toolStart(1, 't1', 'weather'),
        toolDelta(1, '{"city":"Paris"}'),
        toolStart(2, 't2', 'weather'),
        toolDelta(2, '{"city":'),
        toolDelta(2, '"Rome"}'),
        stop(1),
        stop(2),
        { messageStop: { stopReason: 'tool_use' } },
      ],
      {},
      (c) => chunks.push(...c.content)
    );
    assert.deepEqual(chunks, [
      { text: 'Checking ' },
      { text: 'both.' },
      { toolRequest: { name: 'weather', ref: 't1', input: { city: 'Paris' } } },
      { toolRequest: { name: 'weather', ref: 't2', input: { city: 'Rome' } } },
    ]);
    assert.deepEqual(res.message?.content, [
      { text: 'Checking both.' },
      { toolRequest: { name: 'weather', ref: 't1', input: { city: 'Paris' } } },
      { toolRequest: { name: 'weather', ref: 't2', input: { city: 'Rome' } } },
    ]);
    assert.equal(res.finishReason, 'stop');
  });

  it('returns the finish reason and full usage', async () => {
    const res = await run([
      textDelta(0, 'cut'),
      { messageStop: { stopReason: 'max_tokens' } },
      {
        metadata: {
          usage: {
            inputTokens: 5,
            outputTokens: 1,
            totalTokens: 6,
            cacheReadInputTokens: 4,
          },
          metrics: { latencyMs: 12 },
        },
      },
    ]);
    assert.equal(res.finishReason, 'length');
    assert.deepEqual(res.usage, {
      inputTokens: 5,
      outputTokens: 1,
      totalTokens: 6,
      cachedContentTokens: 4,
    });
    assert.deepEqual(res.custom, { metrics: { latencyMs: 12 } });
  });

  it('returns a response that can be serialized', async () => {
    const res = await run([
      textDelta(0, 'ok'),
      { messageStop: { stopReason: 'end_turn' } },
    ]);
    assert.doesNotThrow(() => JSON.stringify(res));
  });

  it('parses fenced JSON in JSON mode', async () => {
    const res = await run(
      [
        textDelta(0, '```json\n{"n":'),
        textDelta(0, ' 1}\n```'),
        { messageStop: { stopReason: 'end_turn' } },
      ],
      { output: { format: 'json' } }
    );
    assert.deepEqual(res.message?.content, [{ data: { n: 1 } }]);
  });

  it("fails on tool input that isn't valid JSON", async () => {
    await assert.rejects(
      run([toolStart(0, 't1', 'weather'), toolDelta(0, '{"city":'), stop(0)]),
      (e: any) =>
        e.status === 'INTERNAL' &&
        /invalid JSON input for tool "weather"/.test(e.message)
    );
  });

  it('maps exceptions sent as stream events', async () => {
    await assert.rejects(
      run([
        textDelta(0, 'partial'),
        { throttlingException: { message: 'slow down' } },
      ]),
      (e: any) =>
        e.status === 'RESOURCE_EXHAUSTED' && /slow down/.test(e.message)
    );
  });

  it('propagates errors thrown by the chunk callback', async () => {
    await assert.rejects(
      run([textDelta(0, 'hi')], {}, () => {
        throw new Error('client went away');
      }),
      /client went away/
    );
  });
});
