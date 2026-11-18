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

import * as assert from 'assert';
import { genkit } from 'genkit';
import { describe, it } from 'node:test';

import { awsBedrockModel } from '../src/generate.js';
import { amazonNovaLiteV1, amazonNovaProV1, awsBedrock } from '../src/index.js';
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

describe('inference region', () => {
  it("doesn't change the chat request body with the client's region", async () => {
    // Capabilities are looked up by model ID, so the region the client was
    // configured with never reaches the request.
    const bodyFor = async (region: string) => {
      const { client, sent } = fakeClient(() => ({
        output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
        stopReason: 'end_turn',
      }));
      (client as unknown as { config: unknown }).config = {
        region: async () => region,
      };
      await awsBedrockModel(`us.${SONNET_45}`, client)(
        { messages: [{ role: 'user', content: [{ text: 'hi' }] }] },
        {}
      );
      return sent[0].input;
    };
    const us = await bodyFor('us-east-1');
    assert.equal(us.modelId, `us.${SONNET_45}`);
    assert.deepEqual(await bodyFor('eu-west-1'), us);
    assert.deepEqual(await bodyFor('ap-southeast-2'), us);
  });
});

describe('model info', () => {
  it("keeps a model ref's info (versions, label, supports) on the action", async () => {
    const { ai } = setup();
    const ref = amazonNovaProV1('us');
    for (const id of ['us.amazon.nova-pro-v1:0', 'amazon.nova-lite-v1:0']) {
      const expected = id.startsWith('us.') ? ref : amazonNovaLiteV1;
      const action = await ai.registry.lookupAction(`/model/aws-bedrock/${id}`);
      const meta = action?.__action.metadata?.model as Record<string, any>;
      assert.ok(expected.info?.versions?.length);
      assert.deepEqual(meta.versions, expected.info?.versions, id);
      assert.equal(meta.label, expected.info?.label, id);
      assert.deepEqual(meta.supports, expected.info?.supports, id);
    }
    // list() reports the same info.
    const listed = await (
      awsBedrock({
        region: 'us-east-1',
        [__testClient]: fakeClient(() => ({})).client,
      } as PluginOptions) as any
    ).list();
    const entry = listed.find((a: any) => a.name === ref.name);
    assert.deepEqual(entry.metadata.model.versions, ref.info?.versions);
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

  it('declares toolChoice per family, not for every model with tools', async () => {
    assert.equal(
      awsBedrock.model(`us.${SONNET_45}`).info?.supports?.toolChoice,
      true
    );
    assert.equal(
      awsBedrock.model('us.amazon.nova-pro-v1:0').info?.supports?.toolChoice,
      true
    );
    // Unknown models and families Bedrock doesn't document default to false.
    for (const id of [
      'custom.new-model-v1:0',
      'amazon.titan-text-express-v1',
      'us.meta.llama3-3-70b-instruct-v1:0',
      'cohere.command-r-v1:0',
      'ai21.jamba-1-5-large-v1:0',
    ]) {
      assert.notEqual(
        awsBedrock.model(id).info?.supports?.toolChoice,
        true,
        id
      );
    }
    const { ai } = setup();
    const action = await ai.registry.lookupAction(
      `/model/aws-bedrock/global.${SONNET_45}`
    );
    assert.equal(
      (
        action?.__action.metadata?.model as {
          supports?: { toolChoice?: boolean };
        }
      )?.supports?.toolChoice,
      true
    );
  });

  it('builds embedder and reranker refs', () => {
    assert.equal(
      awsBedrock.embedder('cohere.embed-v4:0').name,
      'aws-bedrock/cohere.embed-v4:0'
    );
    assert.equal(
      awsBedrock.reranker('cohere.rerank-v3-5:0').name,
      'aws-bedrock/cohere.rerank-v3-5:0'
    );
  });
});
