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

import {
  awsBedrockImageModel,
  fromImageResponse,
  imageFamily,
  toImageRequest,
} from '../src/image.js';
import { awsBedrock } from '../src/index.js';
import { baseModelId } from '../src/models.js';
import { fakeClient, jsonBody } from './mocks/bedrock-client.js';

describe('imageFamily', () => {
  it('routes each family', () => {
    assert.equal(imageFamily('amazon.titan-image-generator-v2:0'), 'titan');
    assert.equal(imageFamily('amazon.nova-canvas-v1:0'), 'titan');
    assert.equal(
      imageFamily('stability.stable-diffusion-xl-v1'),
      'stability-sdxl'
    );
    assert.equal(imageFamily('stability.sd3-5-large-v1:0'), 'stability');
    assert.equal(
      imageFamily('us.stability.stable-image-ultra-v1:1'),
      'stability'
    );
    assert.equal(imageFamily('amazon.nova-pro-v1:0'), undefined);
  });
});

describe('imageFamily prefixes', () => {
  it('strips the same inference-profile prefixes as chat models', () => {
    for (const prefix of ['us', 'us-gov', 'eu', 'apac', 'jp', 'global']) {
      const id = `${prefix}.stability.sd3-5-large-v1:0`;
      assert.equal(baseModelId(id), 'stability.sd3-5-large-v1:0');
      assert.equal(imageFamily(id), 'stability');
    }
  });
});

describe('toImageRequest', () => {
  it('builds the Titan and Nova Canvas request', () => {
    assert.deepEqual(
      toImageRequest('titan', 'a cat', {
        width: 512,
        height: 512,
        negativePrompt: 'dogs',
        imageGenerationConfig: { quality: 'premium' },
      }),
      {
        taskType: 'TEXT_IMAGE',
        textToImageParams: { text: 'a cat', negativeText: 'dogs' },
        imageGenerationConfig: {
          numberOfImages: 1,
          width: 512,
          height: 512,
          cfgScale: undefined,
          seed: undefined,
          quality: 'premium',
        },
      }
    );
  });

  it('builds the SDXL request with a negative prompt', () => {
    const body = toImageRequest('stability-sdxl', 'a cat', {
      negativePrompt: 'dogs',
      steps: 30,
    });
    assert.deepEqual(body.text_prompts, [
      { text: 'a cat', weight: 1 },
      { text: 'dogs', weight: -1 },
    ]);
    assert.equal(body.steps, 30);
  });

  it('builds the SD3 and Stable Image request and passes unknown fields through', () => {
    const body = toImageRequest('stability', 'a cat', {
      aspectRatio: '16:9',
      mode: 'text-to-image',
    } as any);
    assert.equal(body.prompt, 'a cat');
    assert.equal(body.aspect_ratio, '16:9');
    assert.equal(body.output_format, 'png');
    assert.equal(body.mode, 'text-to-image');
  });
});

describe('fromImageResponse', () => {
  it("reads each family's images and filter results", () => {
    assert.deepEqual(fromImageResponse('titan', { images: ['AA'] }), {
      images: ['AA'],
      blocked: undefined,
    });
    assert.deepEqual(
      fromImageResponse('stability-sdxl', {
        artifacts: [
          { base64: 'AA', finishReason: 'SUCCESS' },
          { base64: 'BB', finishReason: 'CONTENT_FILTERED' },
        ],
      }),
      { images: ['AA'], blocked: 'CONTENT_FILTERED' }
    );
    assert.deepEqual(
      fromImageResponse('stability', {
        images: [],
        finish_reasons: ['Filter reason: prompt'],
      }),
      { images: [], blocked: 'Filter reason: prompt' }
    );
  });
});

describe('fromImageResponse with unexpected bodies', () => {
  it('returns no images instead of throwing', () => {
    assert.deepEqual(fromImageResponse('titan', null), { images: [] });
    assert.deepEqual(fromImageResponse('stability', { images: 'x' }), {
      images: [],
      blocked: undefined,
    });
    assert.deepEqual(
      fromImageResponse('stability-sdxl', { artifacts: [null, { base64: 1 }] }),
      { images: [], blocked: undefined }
    );
  });
});

describe('awsBedrockImageModel', () => {
  it('prompts with the latest user message and returns png media', async () => {
    const { client, sent } = fakeClient(() =>
      jsonBody({ images: ['AAAA', 'BBBB'] })
    );
    const res = await awsBedrockImageModel(
      'amazon.nova-canvas-v1:0',
      client
    )({
      messages: [
        { role: 'user', content: [{ text: 'a dog' }] },
        { role: 'model', content: [{ text: 'ok' }] },
        { role: 'user', content: [{ text: 'a cat' }] },
      ],
      config: { numberOfImages: 2 },
    });
    assert.equal(
      JSON.parse(sent[0].input.body).textToImageParams.text,
      'a cat'
    );
    assert.equal(res.finishReason, 'stop');
    assert.deepEqual(res.message?.content, [
      {
        media: { url: 'data:image/png;base64,AAAA', contentType: 'image/png' },
      },
      {
        media: { url: 'data:image/png;base64,BBBB', contentType: 'image/png' },
      },
    ]);
  });

  it('labels Stability images with the requested output_format', async () => {
    const { client, sent } = fakeClient(() => jsonBody({ images: ['AAAA'] }));
    const generate = (config?: Record<string, unknown>) =>
      awsBedrockImageModel(
        'stability.stable-image-core-v1:1',
        client
      )({
        messages: [{ role: 'user', content: [{ text: 'x' }] }],
        config,
      });
    for (const [format, type] of [
      ['jpeg', 'image/jpeg'],
      ['webp', 'image/webp'],
      ['png', 'image/png'],
    ]) {
      const res = await generate({ output_format: format });
      assert.equal(
        JSON.parse(sent[sent.length - 1].input.body).output_format,
        format
      );
      assert.deepEqual(res.message?.content, [
        { media: { url: `data:${type};base64,AAAA`, contentType: type } },
      ]);
    }
    const res = await generate();
    assert.equal(res.message?.content[0].media?.contentType, 'image/png');
  });

  it('labels SDXL images PNG even if the config sets output_format', async () => {
    const { client, sent } = fakeClient(() =>
      jsonBody({ artifacts: [{ base64: 'AAAA', finishReason: 'SUCCESS' }] })
    );
    const res = await awsBedrockImageModel(
      'stability.stable-diffusion-xl-v1',
      client
    )({
      messages: [{ role: 'user', content: [{ text: 'x' }] }],
      config: { output_format: 'jpeg' },
    });
    assert.deepEqual(res.message?.content, [
      {
        media: { url: 'data:image/png;base64,AAAA', contentType: 'image/png' },
      },
    ]);
    assert.equal(JSON.parse(sent[0].input.body).output_format, undefined);
  });

  it('reports filtered output as blocked', async () => {
    const { client } = fakeClient(() =>
      jsonBody({ images: [], finish_reasons: ['Filter reason: output'] })
    );
    const res = await awsBedrockImageModel(
      'stability.stable-image-core-v1:1',
      client
    )({
      messages: [{ role: 'user', content: [{ text: 'x' }] }],
    });
    assert.equal(res.finishReason, 'blocked');
    assert.equal(res.finishMessage, 'Filter reason: output');
  });

  it('needs a text prompt', async () => {
    const { client } = fakeClient(() => jsonBody({ images: ['AA'] }));
    await assert.rejects(
      awsBedrockImageModel('amazon.nova-canvas-v1:0', client)({ messages: [] }),
      /needs a text prompt/
    );
  });

  it('skips custom models that are already registered', async () => {
    const plugin = awsBedrock({
      region: 'us-east-1',
      credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
      customModels: ['amazon.nova-canvas-v1:0', 'amazon.nova-lite-v1:0'],
    });
    const actions = (await plugin.init!()) as {
      __action: { actionType: string; name: string };
    }[];
    const keys = actions.map(
      (a) => `${a.__action.actionType}/${a.__action.name}`
    );
    assert.equal(new Set(keys).size, keys.length);
  });

  it('is registered by the plugin, and custom image models route to it', async () => {
    const ai = genkit({
      plugins: [
        awsBedrock({
          region: 'us-east-1',
          credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
          customModels: ['stability.stable-diffusion-xl-v1'],
        }),
      ],
    });
    const canvas = await ai.registry.lookupAction(
      '/model/aws-bedrock/amazon.nova-canvas-v1:0'
    );
    assert.deepEqual(canvas?.__action.metadata?.model?.supports?.output, [
      'media',
    ]);
    const sdxl = await ai.registry.lookupAction(
      '/model/aws-bedrock/stability.stable-diffusion-xl-v1'
    );
    assert.deepEqual(sdxl?.__action.metadata?.model?.supports?.output, [
      'media',
    ]);
  });
});
