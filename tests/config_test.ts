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

import { toAwsBedrockRequestBody } from '../src/converse.js';
import { awsBedrockModel } from '../src/generate.js';
import {
  AwsBedrockConfigSchema,
  amazonNovaLiteV1,
  anthropicClaudeSonnet45V1,
} from '../src/index.js';
import { fakeClient, streamOf } from './mocks/bedrock-client.js';

const user = { role: 'user' as const, content: [{ text: 'hi' }] };

describe('AwsBedrockConfigSchema', () => {
  it('is the config schema of the model refs', () => {
    assert.equal(amazonNovaLiteV1.configSchema, AwsBedrockConfigSchema);
    assert.equal(
      anthropicClaudeSonnet45V1('us').configSchema,
      AwsBedrockConfigSchema
    );
  });

  it('accepts the common config and the Bedrock fields', () => {
    const parsed = AwsBedrockConfigSchema.parse({
      temperature: 0.2,
      additionalModelRequestFields: {
        thinking: { type: 'enabled', budget_tokens: 1024 },
      },
      guardrailConfig: { guardrailIdentifier: 'g', guardrailVersion: '1' },
      performanceConfig: { latency: 'optimized' },
      serviceTier: 'priority',
      requestMetadata: { team: 'search' },
    });
    assert.equal(parsed.serviceTier, 'priority');
  });

  it('rejects bad values', () => {
    assert.throws(() => AwsBedrockConfigSchema.parse({ serviceTier: 'gold' }));
  });
});

describe('Bedrock request fields', () => {
  it('sends the Bedrock config fields on the request', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        messages: [user],
        config: {
          additionalModelRequestFields: { inferenceConfig: { topK: 20 } },
          additionalModelResponseFieldPaths: ['/stop_sequence'],
          guardrailConfig: {
            guardrailIdentifier: 'g',
            guardrailVersion: '1',
            trace: 'enabled',
          },
          performanceConfig: { latency: 'optimized' },
          serviceTier: 'flex',
          requestMetadata: { team: 'search' },
        },
      },
      'us'
    );
    assert.deepEqual(body.additionalModelRequestFields, {
      inferenceConfig: { topK: 20 },
    });
    assert.deepEqual(body.additionalModelResponseFieldPaths, [
      '/stop_sequence',
    ]);
    assert.deepEqual(body.guardrailConfig, {
      guardrailIdentifier: 'g',
      guardrailVersion: '1',
      trace: 'enabled',
    });
    assert.deepEqual(body.performanceConfig, { latency: 'optimized' });
    assert.deepEqual(body.serviceTier, { type: 'flex' });
    assert.deepEqual(body.requestMetadata, { team: 'search' });
  });

  it("leaves the fields out when they aren't set", () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      { messages: [user] },
      'us'
    );
    for (const key of [
      'additionalModelRequestFields',
      'guardrailConfig',
      'performanceConfig',
      'serviceTier',
      'requestMetadata',
    ]) {
      assert.equal((body as any)[key], undefined, key);
    }
  });

  const guardrail = {
    guardrailIdentifier: 'g',
    guardrailVersion: '1',
    streamProcessingMode: 'async' as const,
  };

  it('drops the guardrail streamProcessingMode for Converse', async () => {
    const { client, sent } = fakeClient(() => ({
      output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
    }));
    await awsBedrockModel(
      'amazon.nova-lite-v1:0',
      client,
      'us'
    )({
      messages: [user],
      config: { guardrailConfig: guardrail },
    });
    assert.deepEqual(sent[0].input.guardrailConfig, {
      guardrailIdentifier: 'g',
      guardrailVersion: '1',
    });
  });

  it('keeps the guardrail streamProcessingMode for ConverseStream', async () => {
    const { client, sent } = fakeClient(() =>
      streamOf([{ messageStop: { stopReason: 'end_turn' } }])
    );
    await awsBedrockModel(
      'amazon.nova-lite-v1:0',
      client,
      'us'
    )(
      { messages: [user], config: { guardrailConfig: guardrail } },
      { onChunk: () => {} }
    );
    assert.deepEqual(sent[0].input.guardrailConfig, guardrail);
  });
});

describe('prompt-cache points', () => {
  it('adds a cache point after parts that ask for one', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.nova-lite-v1:0',
      {
        messages: [
          {
            role: 'system',
            content: [
              { text: 'long instructions', metadata: { cachePoint: true } },
            ],
          },
          {
            role: 'user',
            content: [
              {
                text: 'long document',
                metadata: { cachePoint: { ttl: '1h' } },
              },
              { text: 'question' },
            ],
          },
        ],
      },
      'us'
    );
    assert.deepEqual(body.system, [
      { text: 'long instructions' },
      { cachePoint: { type: 'default' } },
    ]);
    assert.deepEqual(body.messages![0].content, [
      { text: 'long document' },
      { cachePoint: { type: 'default', ttl: '1h' } },
      { text: 'question' },
    ]);
  });
});
