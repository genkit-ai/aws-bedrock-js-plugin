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

import { genkit, z } from 'genkit';

import { awsBedrockModel } from '../src/generate.js';
import { fakeClient } from './mocks/bedrock-client.js';

describe('structured output schema', () => {
  async function sentSchema(output: Record<string, unknown>) {
    const { client, sent } = fakeClient(() => ({
      stopReason: 'end_turn',
      output: {
        message: { role: 'assistant', content: [{ text: '{"joke":"x"}' }] },
      },
    }));
    const ai = genkit({});
    const model = awsBedrockModel(
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      client
    );
    ai.registry.registerAction('model', model);
    await ai.generate({ model: model.__action.name, prompt: 'joke', output });
    return JSON.parse(
      sent[0].input.outputConfig.textFormat.structure.jsonSchema.schema
    );
  }

  const joke = z.object({ joke: z.string() });

  it('sends additionalProperties: true for a plain zod object, which Bedrock rejects', async () => {
    assert.equal(
      (await sentSchema({ schema: joke })).additionalProperties,
      true
    );
  });

  it('sends additionalProperties: false for a strict zod object or a JSON schema', async () => {
    assert.equal(
      (await sentSchema({ schema: joke.strict() })).additionalProperties,
      false
    );
    assert.equal(
      (
        await sentSchema({
          format: 'json',
          jsonSchema: {
            type: 'object',
            properties: { joke: { type: 'string' } },
            additionalProperties: false,
          },
        })
      ).additionalProperties,
      false
    );
  });
});
