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

import {
  awsBedrockEmbedder,
  embedderFamily,
} from '../src/aws_bedrock_embedders.js';
import { fakeClient, jsonBody } from './mocks/bedrock-client.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const text = (t: string) => ({ content: [{ text: t }] });
const image = (url = PNG) => ({ content: [{ media: { url } }] });

describe('embedderFamily', () => {
  it('picks the family from the model ID, ignoring inference prefixes', () => {
    assert.equal(embedderFamily('amazon.titan-embed-text-v2:0'), 'titan-text');
    assert.equal(
      embedderFamily('amazon.titan-embed-image-v1'),
      'titan-multimodal'
    );
    assert.equal(embedderFamily('us.cohere.embed-v4:0'), 'cohere');
    assert.equal(
      embedderFamily('amazon.nova-2-multimodal-embeddings-v1:0'),
      'nova'
    );
    assert.equal(embedderFamily('amazon.nova-pro-v1:0'), undefined);
  });
});

describe('Titan Text', () => {
  it('returns one embedding per document, in order', async () => {
    const { client, sent } = fakeClient((c) => {
      const { inputText } = JSON.parse(c.input.body);
      return jsonBody({ embedding: [inputText.length] });
    });
    const embed = awsBedrockEmbedder('amazon.titan-embed-text-v2:0', client);
    const res = await embed({ input: [text('a'), text('bb'), text('ccc')] });

    assert.equal(sent.length, 3);
    assert.deepEqual(res.embeddings, [
      { embedding: [1] },
      { embedding: [2] },
      { embedding: [3] },
    ]);
  });

  it('sends normalize', async () => {
    const { client, sent } = fakeClient(() => jsonBody({ embedding: [1] }));
    await awsBedrockEmbedder(
      'amazon.titan-embed-text-v2:0',
      client
    )({
      input: [text('a')],
      options: { normalize: true },
    });
    assert.deepEqual(JSON.parse(sent[0].input.body), {
      inputText: 'a',
      normalize: true,
    });
  });

  it('rejects images', async () => {
    const { client } = fakeClient(() => jsonBody({ embedding: [1] }));
    await assert.rejects(
      awsBedrockEmbedder(
        'amazon.titan-embed-text-v2:0',
        client
      )({ input: [image()] }),
      /only embeds text/
    );
  });
});

describe('Titan Multimodal', () => {
  it('sends text and image together with the output length', async () => {
    const { client, sent } = fakeClient(() => jsonBody({ embedding: [1] }));
    await awsBedrockEmbedder(
      'amazon.titan-embed-image-v1',
      client
    )({
      input: [{ content: [{ text: 'a cat' }, { media: { url: PNG } }] }],
      options: { dimensions: 384 },
    });
    assert.deepEqual(JSON.parse(sent[0].input.body), {
      inputText: 'a cat',
      inputImage: 'iVBORw0KGgo=',
      embeddingConfig: { outputEmbeddingLength: 384 },
    });
  });

  it("rejects image types Titan doesn't take", async () => {
    const { client } = fakeClient(() => jsonBody({ embedding: [1] }));
    await assert.rejects(
      awsBedrockEmbedder(
        'amazon.titan-embed-image-v1',
        client
      )({
        input: [image('data:image/webp;base64,AAAA')],
      }),
      /png or jpeg images, not image\/webp/
    );
  });
});

describe('Cohere', () => {
  it('batches texts 96 at a time and keeps the order', async () => {
    const { client, sent } = fakeClient((c) => {
      const { texts } = JSON.parse(c.input.body);
      return jsonBody({
        embeddings: { float: texts.map((t: string) => [Number(t)]) },
      });
    });
    const input = Array.from({ length: 100 }, (_, i) => text(String(i)));
    const res = await awsBedrockEmbedder(
      'cohere.embed-english-v3',
      client
    )({ input });

    assert.equal(sent.length, 2);
    assert.equal(JSON.parse(sent[0].input.body).texts.length, 96);
    assert.deepEqual(
      JSON.parse(sent[0].input.body).input_type,
      'search_document'
    );
    assert.deepEqual(
      res.embeddings.map((e) => e.embedding[0]),
      Array.from({ length: 100 }, (_, i) => i)
    );
  });

  it('embeds images one per request and slots them back in order', async () => {
    const { client, sent } = fakeClient((c) => {
      const body = JSON.parse(c.input.body);
      return jsonBody({
        embeddings: body.images ? [[9]] : body.texts.map(() => [1]),
      });
    });
    const res = await awsBedrockEmbedder(
      'cohere.embed-v4:0',
      client
    )({
      input: [text('a'), image(), text('b')],
      options: { inputType: 'search_query', dimensions: 256 },
    });

    const imageCall = sent
      .map((s) => JSON.parse(s.input.body))
      .find((b) => b.images);
    assert.deepEqual(imageCall, {
      embedding_types: ['float'],
      output_dimension: 256,
      images: [PNG],
      input_type: 'image',
    });
    assert.deepEqual(
      res.embeddings.map((e) => e.embedding[0]),
      [1, 9, 1]
    );
  });
});

describe('Nova', () => {
  it('sends the single-embedding request for text and images', async () => {
    const { client, sent } = fakeClient(() =>
      jsonBody({ embeddings: [{ embeddingType: 'TEXT', embedding: [0.5] }] })
    );
    const res = await awsBedrockEmbedder(
      'amazon.nova-2-multimodal-embeddings-v1:0',
      client
    )({
      input: [text('hello'), image()],
      options: { dimensions: 1024, embeddingPurpose: 'TEXT_RETRIEVAL' },
    });

    assert.deepEqual(JSON.parse(sent[0].input.body), {
      taskType: 'SINGLE_EMBEDDING',
      singleEmbeddingParams: {
        embeddingPurpose: 'TEXT_RETRIEVAL',
        embeddingDimension: 1024,
        text: { truncationMode: 'END', value: 'hello' },
      },
    });
    assert.deepEqual(
      JSON.parse(sent[1].input.body).singleEmbeddingParams.image,
      {
        format: 'png',
        source: { bytes: 'iVBORw0KGgo=' },
      }
    );
    assert.equal(res.embeddings.length, 2);
  });
});

describe('errors', () => {
  it('rejects documents with nothing to embed', async () => {
    const { client } = fakeClient(() => jsonBody({ embedding: [1] }));
    await assert.rejects(
      awsBedrockEmbedder(
        'amazon.titan-embed-text-v2:0',
        client
      )({ input: [{ content: [] }] }),
      (e: any) =>
        e.status === 'INVALID_ARGUMENT' &&
        /Document 0 has no text or media/.test(e.message)
    );
  });

  it('maps Bedrock exceptions', async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error('slow down'), {
        name: 'ThrottlingException',
      });
    });
    await assert.rejects(
      awsBedrockEmbedder(
        'amazon.titan-embed-text-v2:0',
        client
      )({ input: [text('a')] }),
      (e: any) => e.status === 'RESOURCE_EXHAUSTED'
    );
  });

  it('fails when Bedrock returns no vector', async () => {
    const { client } = fakeClient(() => jsonBody({}));
    await assert.rejects(
      awsBedrockEmbedder(
        'amazon.titan-embed-text-v2:0',
        client
      )({ input: [text('a')] }),
      /no embedding for document 0/
    );
  });
});
