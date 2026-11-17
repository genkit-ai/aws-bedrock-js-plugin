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

import { toAwsBedrockRequestBody } from '../src/converse.js';

const tools = [
  { name: 'weather', description: 'Weather', inputSchema: { type: 'object' } },
  { name: 'time', description: 'Time', inputSchema: { type: 'object' } },
];
const user = { role: 'user' as const, content: [{ text: 'hi' }] };

function toolConfig(extra: Record<string, unknown>, messages: any[] = [user]) {
  return toAwsBedrockRequestBody(
    'amazon.nova-lite-v1:0',
    { messages, tools, ...extra },
    'us'
  ).toolConfig;
}

describe('tool choice', () => {
  it('leaves the choice to Bedrock by default', () => {
    const config = toolConfig({});
    assert.equal(config?.tools?.length, 2);
    assert.equal(config?.toolChoice, undefined);
  });

  it('maps auto and required', () => {
    assert.deepEqual(toolConfig({ toolChoice: 'auto' })?.toolChoice, {
      auto: {},
    });
    assert.deepEqual(toolConfig({ toolChoice: 'required' })?.toolChoice, {
      any: {},
    });
  });

  it('names a specific tool from config', () => {
    assert.deepEqual(
      toolConfig({ toolChoice: 'required', config: { toolChoice: 'time' } })
        ?.toolChoice,
      { tool: { name: 'time' } }
    );
  });

  it("rejects a tool name that isn't one of the request's tools", () => {
    assert.throws(
      () => toolConfig({ config: { toolChoice: 'stocks' } }),
      (e: any) =>
        e.status === 'INVALID_ARGUMENT' &&
        /"stocks" does not match/.test(e.message)
    );
  });

  it('sends no tools for none', () => {
    assert.equal(toolConfig({ toolChoice: 'none' }), undefined);
  });

  it('keeps the tools for none when the conversation has tool calls', () => {
    const config = toolConfig({ toolChoice: 'none' }, [
      user,
      {
        role: 'model',
        content: [{ toolRequest: { name: 'weather', ref: 't1', input: {} } }],
      },
      {
        role: 'tool',
        content: [
          { toolResponse: { name: 'weather', ref: 't1', output: 'sunny' } },
        ],
      },
    ]);
    assert.equal(config?.tools?.length, 2);
    assert.equal(config?.toolChoice, undefined);
  });

  it('ignores tool choice for models without tool support', () => {
    const body = toAwsBedrockRequestBody(
      'amazon.titan-text-express-v1',
      { messages: [user], tools, toolChoice: 'required' },
      'us'
    );
    assert.equal(body.toolConfig, undefined);
  });
});
