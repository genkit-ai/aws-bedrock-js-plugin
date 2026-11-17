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
import { afterEach, beforeEach, describe, it } from 'node:test';

import { awsBedrock } from '../src/index.js';
import { inferenceProfileGeography } from '../src/models.js';

const SONNET_45 = 'anthropic.claude-sonnet-4-5-20250929-v1:0';
const ENV_KEYS = [
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'AWS_PROFILE',
  'AWS_CONFIG_FILE',
  'AWS_SHARED_CREDENTIALS_FILE',
];

/** The action keys a plugin registers in init. */
async function registered(plugin: ReturnType<typeof awsBedrock>) {
  const ai = genkit({ plugins: [plugin] });
  return { names: Object.keys(await ai.registry.listActions()) };
}

describe('inferenceProfileGeography', () => {
  it('maps regions to inference-profile geographies', () => {
    assert.equal(inferenceProfileGeography('us-east-1'), 'us');
    assert.equal(inferenceProfileGeography('us-gov-west-1'), 'us-gov');
    assert.equal(inferenceProfileGeography('eu-central-1'), 'eu');
    assert.equal(inferenceProfileGeography('ap-southeast-2'), 'apac');
    assert.equal(inferenceProfileGeography('ca-central-1'), '');
    assert.equal(inferenceProfileGeography('sa-east-1'), '');
  });
});

describe('region resolution', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    for (const k of ENV_KEYS) delete process.env[k];
    // Keep the developer's own AWS config out of the tests.
    process.env.AWS_CONFIG_FILE = '/nonexistent/config';
    process.env.AWS_SHARED_CREDENTIALS_FILE = '/nonexistent/credentials';
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('uses the region from AWS_REGION', async () => {
    process.env.AWS_REGION = 'eu-west-1';
    const { names } = await registered(awsBedrock());
    assert.ok(names.includes(`/model/aws-bedrock/eu.${SONNET_45}`));
  });

  it('uses a region provider function', async () => {
    const { names } = await registered(
      awsBedrock({ region: async () => 'ap-northeast-1' })
    );
    assert.ok(names.includes(`/model/aws-bedrock/apac.${SONNET_45}`));
  });

  it('uses in-region IDs where there is no inference-profile geography', async () => {
    const { names } = await registered(awsBedrock({ region: 'ca-central-1' }));
    assert.ok(names.includes(`/model/aws-bedrock/${SONNET_45}`));
    assert.ok(!names.some((n) => n.startsWith('/model/aws-bedrock/.')));
  });

  it('falls back to the us geography when no region resolves', async () => {
    const { names } = await registered(awsBedrock());
    assert.ok(names.includes(`/model/aws-bedrock/us.${SONNET_45}`));
  });
});
