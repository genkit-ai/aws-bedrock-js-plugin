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

import { Message } from 'genkit';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromAwsBedrockChoice, toAwsBedrockMessages } from '../src/converse.js';
import { awsBedrockModel } from '../src/generate.js';
import { fakeClient, streamOf } from './mocks/bedrock-client.js';

const REDACTED = new Uint8Array([1, 2, 3]);

const converseOutput = {
  output: {
    message: {
      role: 'assistant',
      content: [
        {
          reasoningContent: {
            reasoningText: { text: '17*23 = 391', signature: 'sig-1' },
          },
        },
        { reasoningContent: { redactedContent: REDACTED } },
        { text: '391' },
      ],
    },
  },
  stopReason: 'end_turn',
} as any;

describe('reasoning', () => {
  it('returns reasoning parts with their signature and redacted bytes', () => {
    const res = fromAwsBedrockChoice(converseOutput);
    assert.deepEqual(res.message?.content, [
      {
        reasoning: '17*23 = 391',
        metadata: { bedrockReasoningSignature: 'sig-1' },
      },
      { reasoning: '', metadata: { bedrockRedactedContent: 'AQID' } },
      { text: '391' },
    ]);
  });

  it('leaves reasoning out of the response text', () => {
    const res = fromAwsBedrockChoice(converseOutput);
    assert.equal(new Message(res.message!).text, '391');
  });

  it('sends Bedrock reasoning back unchanged on the next turn', () => {
    const res = fromAwsBedrockChoice(converseOutput);
    const [msg] = toAwsBedrockMessages([res.message!]);
    assert.deepEqual(msg.content, [
      {
        reasoningContent: {
          reasoningText: { text: '17*23 = 391', signature: 'sig-1' },
        },
      },
      { reasoningContent: { redactedContent: REDACTED } },
      { text: '391' },
    ]);
  });

  it("drops reasoning that didn't come from Bedrock", () => {
    const [msg] = toAwsBedrockMessages([
      {
        role: 'model',
        content: [{ reasoning: 'from elsewhere' }, { text: '391' }],
      },
    ]);
    assert.deepEqual(msg.content, [{ text: '391' }]);
  });

  it('keeps reasoning ahead of the data part in JSON mode', () => {
    const res = fromAwsBedrockChoice(
      {
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                reasoningContent: {
                  reasoningText: { text: 'think', signature: 's' },
                },
              },
              { text: '{"n":1}' },
            ],
          },
        },
      } as any,
      true
    );
    assert.deepEqual(res.message?.content, [
      { reasoning: 'think', metadata: { bedrockReasoningSignature: 's' } },
      { data: { n: 1 } },
    ]);
  });

  it('streams reasoning and keeps it in the final message', async () => {
    const { client } = fakeClient(() =>
      streamOf([
        {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { reasoningContent: { text: '17*23' } },
          },
        },
        {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { reasoningContent: { text: ' = 391' } },
          },
        },
        {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { reasoningContent: { signature: 'sig-1' } },
          },
        },
        { contentBlockStop: { contentBlockIndex: 0 } },
        { contentBlockDelta: { contentBlockIndex: 1, delta: { text: '391' } } },
        { messageStop: { stopReason: 'end_turn' } },
      ])
    );
    const chunks: any[] = [];
    const res = await awsBedrockModel(
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      client,
      'us'
    )(
      { messages: [{ role: 'user', content: [{ text: '17*23?' }] }] },
      { onChunk: (c) => chunks.push(...c.content) }
    );
    assert.deepEqual(chunks, [
      { reasoning: '17*23' },
      { reasoning: ' = 391' },
      { text: '391' },
    ]);
    assert.deepEqual(res.message?.content, [
      {
        reasoning: '17*23 = 391',
        metadata: { bedrockReasoningSignature: 'sig-1' },
      },
      { text: '391' },
    ]);
  });
});
