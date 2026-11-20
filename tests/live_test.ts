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

/**
 * Live tests that call AWS Bedrock. Every block is skipped unless its model
 * is set, so `npm test` never calls AWS. They use your usual AWS credentials
 * and region (AWS_PROFILE, AWS_REGION, ...).
 *
 *   BEDROCK_LIVE_CLAUDE=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
 *   BEDROCK_LIVE_NOVA=us.amazon.nova-lite-v1:0 \
 *   BEDROCK_LIVE_EMBEDDERS=amazon.titan-embed-text-v2:0,cohere.embed-v4:0,amazon.nova-2-multimodal-embeddings-v1:0 \
 *   BEDROCK_LIVE_RERANKER=cohere.rerank-v3-5:0 \
 *   BEDROCK_LIVE_IMAGE=amazon.nova-canvas-v1:0 \
 *   npm run test:live
 */

import * as assert from 'assert';
import { Document, genkit, z } from 'genkit';
import { describe, it } from 'node:test';

import { awsBedrock } from '../src/index.js';

const CLAUDE = process.env.BEDROCK_LIVE_CLAUDE;
const NOVA = process.env.BEDROCK_LIVE_NOVA;
const EMBEDDERS = (process.env.BEDROCK_LIVE_EMBEDDERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RERANKER = process.env.BEDROCK_LIVE_RERANKER;
const IMAGE = process.env.BEDROCK_LIVE_IMAGE;

// A 1x1 red PNG.
const RED_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const ai = genkit({ plugins: [awsBedrock()] });

const weather = ai.defineTool(
  {
    name: 'weather',
    description: 'Returns the weather in a city.',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.string(),
  },
  async ({ city }) => (city.toLowerCase().includes('paris') ? 'sunny' : 'rainy')
);

describe('live: Claude', { skip: !CLAUDE }, () => {
  const model = awsBedrock.model(CLAUDE ?? '');

  it('generates text with a finish reason and usage', async () => {
    const res = await ai.generate({
      model,
      prompt: 'Say "hello" and nothing else.',
    });
    assert.match(res.text.toLowerCase(), /hello/);
    assert.equal(res.finishReason, 'stop');
    assert.ok(res.usage?.inputTokens);
    assert.ok(res.usage.inputTokens > 0);
  });

  it('streams text', async () => {
    const { stream, response } = ai.generateStream({
      model,
      prompt: 'Count from 1 to 5, comma separated.',
    });
    let chunks = 0;
    for await (const chunk of stream) if (chunk.text) chunks++;
    const res = await response;
    assert.ok(chunks > 0);
    assert.match(res.text, /1.*5/s);
    assert.equal(res.finishReason, 'stop');
  });

  it('runs parallel tool calls (#664)', async () => {
    const res = await ai.generate({
      model,
      tools: [weather],
      prompt:
        'Use the weather tool for Paris and for Rome, in parallel, then say which is sunny.',
    });
    assert.match(res.text, /Paris/);
  });

  it('streams a tool loop', async () => {
    const { response } = ai.generateStream({
      model,
      tools: [weather],
      prompt: 'What is the weather in Paris? Use the tool.',
    });
    assert.match((await response).text.toLowerCase(), /sunny/);
  });

  it("finishes a tool loop with toolChoice 'required'", async () => {
    const res = await ai.generate({
      model,
      tools: [weather],
      toolChoice: 'required',
      prompt: 'What is the weather in Paris?',
    });
    assert.match(res.text.toLowerCase(), /sunny/);
    assert.ok(
      res.messages.some((m) => m.content.some((p) => p.toolRequest)),
      'the tool was never called'
    );
  });

  it('finishes a tool loop with a named config.toolChoice', async () => {
    const res = await ai.generate({
      model,
      tools: [weather],
      prompt: 'What is the weather in Paris?',
      config: { toolChoice: 'weather' },
    });
    assert.match(res.text.toLowerCase(), /sunny/);
    assert.ok(
      res.messages.some((m) => m.content.some((p) => p.toolRequest)),
      'the tool was never called'
    );
  });

  it('replays signed reasoning across tool calls', async () => {
    const res = await ai.generate({
      model,
      tools: [weather],
      prompt: 'Use the tool to get the weather in Paris, then answer briefly.',
      config: {
        maxOutputTokens: 4096,
        additionalModelRequestFields: {
          thinking: { type: 'enabled', budget_tokens: 1024 },
        },
      },
    });
    assert.ok(res.messages.some((m) => m.content.some((p) => p.reasoning)));
    assert.match(res.text.toLowerCase(), /sunny/);
  });

  it('returns structured output', async () => {
    // Bedrock rejects schemas with additionalProperties: true, which Genkit
    // emits for a plain z.object(); .strict() makes it false.
    const res = await ai.generate({
      model,
      prompt: 'Give the capital of France.',
      output: {
        schema: z.object({ city: z.string(), country: z.string() }).strict(),
      },
    });
    assert.ok(res.output);
    assert.match(res.output.city, /Paris/);
  });
});

describe('live: Nova', { skip: !NOVA }, () => {
  const model = awsBedrock.model(NOVA ?? '');

  it('generates text', async () => {
    const res = await ai.generate({ model, prompt: 'Say "hello".' });
    assert.match(res.text.toLowerCase(), /hello/);
  });

  it('reads an image', async () => {
    const res = await ai.generate({
      model,
      prompt: [
        { text: 'What colour is this image? One word.' },
        { media: { url: RED_PIXEL } },
      ],
    });
    assert.match(res.text.toLowerCase(), /red/);
  });
});

describe('live: embedders', { skip: EMBEDDERS.length === 0 }, () => {
  for (const id of EMBEDDERS) {
    it(`embeds each document with ${id}`, async () => {
      const res = await ai.embedMany({
        embedder: awsBedrock.embedder(id),
        content: ['the cat sat on the mat', 'stock markets fell today'],
      });
      assert.equal(res.length, 2);
      assert.ok(res.every((e) => e.embedding.length > 0));
      assert.notDeepEqual(res[0].embedding, res[1].embedding);
    });
  }
});

describe('live: reranker', { skip: !RERANKER }, () => {
  it('puts the relevant document first', async () => {
    const ranked = await ai.rerank({
      reranker: awsBedrock.reranker(RERANKER ?? ''),
      query: 'What is the capital of France?',
      documents: [
        Document.fromText('Berlin is the capital of Germany.'),
        Document.fromText('Paris is the capital of France.'),
      ],
    });
    assert.match(ranked[0].text, /Paris/);
    assert.ok(ranked[0].metadata.score >= ranked[1].metadata.score);
  });
});

describe('live: image generation', { skip: !IMAGE }, () => {
  it('returns a png', async () => {
    const res = await ai.generate({
      model: awsBedrock.model(IMAGE ?? ''),
      prompt: 'A small red square on a white background',
    });
    assert.ok(res.media?.url, 'no image returned');
    assert.match(res.media.url, /^data:image\/png;base64,/);
  });
});
