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

import { genkit } from 'genkit';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { amazonNovaProV1, awsBedrock } from '../src/index.js';

describe('awsBedrock plugin', () => {
  it("registers the known models with the region's inference prefix", async () => {
    const ai = genkit({
      plugins: [
        awsBedrock({
          region: 'eu-west-1',
          credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
        }),
      ],
    });
    const action = await ai.registry.lookupAction(
      '/model/aws-bedrock/eu.amazon.nova-pro-v1:0'
    );
    assert.ok(action, 'eu.amazon.nova-pro-v1:0 should be registered');
    assert.equal(
      amazonNovaProV1('eu').name,
      'aws-bedrock/eu.amazon.nova-pro-v1:0'
    );
  });

  it('registers custom models', async () => {
    const ai = genkit({
      plugins: [
        awsBedrock({
          region: 'us-east-1',
          credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
          customModels: ['custom.my-model-v1:0'],
        }),
      ],
    });
    assert.ok(
      await ai.registry.lookupAction('/model/aws-bedrock/custom.my-model-v1:0')
    );
  });

  it('registers the embedders', async () => {
    const ai = genkit({
      plugins: [
        awsBedrock({
          region: 'us-east-1',
          credentials: { accessKeyId: 'x', secretAccessKey: 'y' },
        }),
      ],
    });
    assert.ok(
      await ai.registry.lookupAction(
        '/embedder/aws-bedrock/amazon.titan-embed-text-v2:0'
      )
    );
  });
});
