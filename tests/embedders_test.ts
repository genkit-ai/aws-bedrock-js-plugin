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

import { awsBedrockEmbedder } from '../src/aws_bedrock_embedders.js';
import { fakeClient, jsonBody } from './mocks/bedrock-client.js';

describe('awsBedrockEmbedder', () => {
  it('embeds a document with Titan text v2', async () => {
    const { client, sent } = fakeClient(() =>
      jsonBody({ embedding: [0.1, 0.2] })
    );
    const embedder = awsBedrockEmbedder('amazon.titan-embed-text-v2:0', client);
    const res = await embedder({
      input: [{ content: [{ text: 'hello' }] }],
      options: { dimensions: 256 },
    });

    assert.equal(sent.length, 1);

    assert.equal(sent[0].name, 'InvokeModelCommand');
    assert.equal(sent[0].input.modelId, 'amazon.titan-embed-text-v2:0');
    assert.deepEqual(JSON.parse(sent[0].input.body), {
      inputText: 'hello',
      dimensions: 256,
    });
    assert.deepEqual(res.embeddings, [{ embedding: [0.1, 0.2] }]);
  });

  it('rejects unknown embedders', () => {
    const { client } = fakeClient(() => ({}));
    assert.throws(
      () => awsBedrockEmbedder('nope', client),
      /Unsupported model: nope/
    );
  });
});
