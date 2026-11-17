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

import * as assert from 'assert';
import { genkit } from 'genkit';
import { describe, it } from 'node:test';

import { awsBedrock } from '../src/index.js';
import { baseModelId, modelInfoFor } from '../src/models.js';
import { __testClient, type PluginOptions } from '../src/types.js';
import { fakeClient } from './mocks/bedrock-client.js';

const SONNET_45 = 'anthropic.claude-sonnet-4-5-20250929-v1:0';

function setup() {
  const fake = fakeClient(() => ({
    output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
    stopReason: 'end_turn',
  }));
  const ai = genkit({
    plugins: [
      awsBedrock({
        region: 'us-east-1',
        [__testClient]: fake.client,
      } as PluginOptions),
    ],
  });
  return { ai, sent: fake.sent };
}

describe('capability lookup', () => {
  it('strips inference-profile prefixes', () => {
    for (const prefix of ['us', 'us-gov', 'eu', 'apac', 'jp', 'au', 'global']) {
      assert.equal(baseModelId(`${prefix}.${SONNET_45}`), SONNET_45);
    }
    assert.equal(baseModelId('amazon.nova-lite-v1:0'), 'amazon.nova-lite-v1:0');
  });

  it('finds known models under any prefix', () => {
    assert.equal(
      modelInfoFor(`global.${SONNET_45}`).label,
      'Anthropic - Claude Sonnet 4.5 V1'
    );
    assert.equal(modelInfoFor(`jp.${SONNET_45}`).supports.constrained, 'all');
    assert.equal(
      modelInfoFor('amazon.titan-text-express-v1').supports.systemRole,
      false
    );
  });

  it('gives unknown models modern Converse defaults', () => {
    const info = modelInfoFor('us.example.new-model-v9:0');
    assert.equal(info.label, 'AWS Bedrock - us.example.new-model-v9:0');
    assert.deepEqual(info.supports.output, ['text', 'json']);
    assert.equal(info.supports.tools, true);
  });
});

describe('resolve', () => {
  it('resolves any model ID and sends the full ID to Bedrock', async () => {
    const { ai, sent } = setup();
    const res = await ai.generate({
      model: `aws-bedrock/global.${SONNET_45}`,
      prompt: 'hi',
    });
    assert.equal(res.text, 'ok');
    assert.equal(sent[0].input.modelId, `global.${SONNET_45}`);
  });

  it('gives resolved models their capabilities', async () => {
    const { ai } = setup();
    const action = await ai.registry.lookupAction(
      '/model/aws-bedrock/eu.example.new-model-v1:0'
    );
    assert.equal(action?.__action.metadata?.model?.supports?.tools, true);
  });

  it('resolves embedders and rerankers in known families', async () => {
    const { ai } = setup();
    assert.ok(
      await ai.registry.lookupAction(
        '/embedder/aws-bedrock/us.cohere.embed-v4:0'
      )
    );
    assert.ok(
      await ai.registry.lookupAction('/reranker/aws-bedrock/cohere.rerank-v9:0')
    );
    assert.equal(
      await ai.registry.lookupAction(
        '/embedder/aws-bedrock/amazon.nova-pro-v1:0'
      ),
      undefined
    );
  });

  it("doesn't resolve embedding or rerank IDs as chat models", async () => {
    const { ai } = setup();
    assert.equal(
      await ai.registry.lookupAction(
        '/model/aws-bedrock/amazon.titan-embed-text-v2:0'
      ),
      undefined
    );
  });

  it('routes image model IDs to the image model', async () => {
    const { ai } = setup();
    const action = await ai.registry.lookupAction(
      '/model/aws-bedrock/amazon.titan-image-generator-v1'
    );
    assert.deepEqual(action?.__action.metadata?.model?.supports?.output, [
      'media',
    ]);
  });
});

describe('list', () => {
  it('lists the known models, image models and embedders', async () => {
    const plugin = awsBedrock({ region: 'us-east-1' });
    const list = await plugin.list!();
    const names = list.map((a) => `${a.actionType}:${a.name}`);
    assert.ok(names.includes(`model:aws-bedrock/us.${SONNET_45}`));
    assert.ok(names.includes('model:aws-bedrock/amazon.nova-canvas-v1:0'));
    assert.ok(
      names.includes('embedder:aws-bedrock/amazon.titan-embed-text-v2:0')
    );
  });
});

describe('references', () => {
  it('builds model refs for any ID', () => {
    const ref = awsBedrock.model(`global.${SONNET_45}`, { temperature: 0.2 });
    assert.equal(ref.name, `aws-bedrock/global.${SONNET_45}`);
    assert.equal(ref.info?.label, 'Anthropic - Claude Sonnet 4.5 V1');
    assert.deepEqual(ref.config, { temperature: 0.2 });
    assert.deepEqual(
      awsBedrock.model('amazon.nova-canvas-v1:0').info?.supports?.output,
      ['media']
    );
  });

  it('builds embedder and reranker refs', () => {
    assert.equal(
      awsBedrock.embedder('cohere.embed-v4:0').name,
      'aws-bedrock/cohere.embed-v4:0'
    );
    assert.equal(
      awsBedrock.reranker('amazon.rerank-v1:0').name,
      'aws-bedrock/amazon.rerank-v1:0'
    );
  });
});
