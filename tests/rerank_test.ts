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

import { genkit } from 'genkit';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awsBedrock, cohereRerank35 } from '../src/index.js';
import { awsBedrockReranker, toRerankRequest } from '../src/rerank.js';
import { fakeClient, jsonBody } from './mocks/bedrock-client.js';

const doc = (text: string, metadata?: Record<string, unknown>) => ({
  content: [{ text }],
  metadata,
});

describe('toRerankRequest', () => {
  it('adds api_version for Cohere and caps top_n at the document count', () => {
    assert.deepEqual(
      toRerankRequest('cohere.rerank-v3-5:0', 'q', ['a', 'b'], { k: 5 }),
      {
        query: 'q',
        documents: ['a', 'b'],
        top_n: 2,
        api_version: 2,
      }
    );
    assert.deepEqual(
      toRerankRequest('amazon.rerank-v1:0', 'q', ['a', 'b'], { k: 1 }),
      {
        query: 'q',
        documents: ['a', 'b'],
        top_n: 1,
      }
    );
  });
});

describe('awsBedrockReranker', () => {
  it('orders documents by relevance and keeps their metadata', async () => {
    const { client, sent } = fakeClient(() =>
      jsonBody({
        results: [
          { index: 2, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.4 },
        ],
      })
    );
    const action = awsBedrockReranker('cohere.rerank-v3-5:0', client);
    const res = await action({
      query: doc('capital of France'),
      documents: [
        doc('Berlin', { id: 'a' }),
        doc('Madrid', { id: 'b' }),
        doc('Paris', { id: 'c' }),
      ],
      options: { k: 2 },
    });

    assert.equal(sent[0].input.modelId, 'cohere.rerank-v3-5:0');
    assert.equal(JSON.parse(sent[0].input.body).top_n, 2);
    assert.deepEqual(res.documents, [
      { content: [{ text: 'Paris' }], metadata: { id: 'c', score: 0.9 } },
      { content: [{ text: 'Berlin' }], metadata: { id: 'a', score: 0.4 } },
    ]);
  });

  it('returns nothing for no documents without calling Bedrock', async () => {
    const { client, sent } = fakeClient(() => jsonBody({ results: [] }));
    const res = await awsBedrockReranker(
      'amazon.rerank-v1:0',
      client
    )({
      query: doc('q'),
      documents: [],
    });
    assert.deepEqual(res.documents, []);
    assert.equal(sent.length, 0);
  });

  it('rejects documents without text', async () => {
    const { client } = fakeClient(() => jsonBody({ results: [] }));
    await assert.rejects(
      awsBedrockReranker(
        'amazon.rerank-v1:0',
        client
      )({
        query: doc('q'),
        documents: [
          { content: [{ media: { url: 'data:image/png;base64,AA==' } }] },
        ],
      }),
      /Document 0 has no text to rerank/
    );
  });

  it('maps Bedrock exceptions', async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error('no access'), {
        name: 'AccessDeniedException',
      });
    });
    await assert.rejects(
      awsBedrockReranker(
        'amazon.rerank-v1:0',
        client
      )({ query: doc('q'), documents: [doc('a')] }),
      (e: any) => e.status === 'PERMISSION_DENIED'
    );
  });
});

describe('plugin registration', () => {
  const plugin = () =>
    awsBedrock({
      region: 'us-west-2',
      credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
    });

  it('registers the rerankers', async () => {
    const ai = genkit({ plugins: [plugin()] });
    assert.ok(
      await ai.registry.lookupAction(`/reranker/${cohereRerank35.name}`)
    );
    assert.ok(
      await ai.registry.lookupAction('/reranker/aws-bedrock/amazon.rerank-v1:0')
    );
  });

  it('no longer registers Cohere Rerank as a chat model', async () => {
    const ai = genkit({ plugins: [plugin()] });
    assert.equal(
      await ai.registry.lookupAction('/model/aws-bedrock/cohere.rerank-v3-5:0'),
      undefined
    );
  });
});
