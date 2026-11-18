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

import { genkit, z } from 'genkit';

import { toAwsBedrockRequestBody } from '../src/converse.js';
import { awsBedrockModel } from '../src/generate.js';
import { fakeClient } from './mocks/bedrock-client.js';

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

  it('stops forcing the named tool once it has answered this turn', () => {
    const called = [
      user,
      {
        role: 'model',
        content: [{ toolRequest: { name: 'time', ref: 't1', input: {} } }],
      },
      {
        role: 'tool',
        content: [{ toolResponse: { name: 'time', ref: 't1', output: '9am' } }],
      },
    ];
    assert.deepEqual(
      toolConfig({ config: { toolChoice: 'time' } }, called)?.toolChoice,
      { auto: {} }
    );
    // Another tool's result doesn't count.
    assert.deepEqual(
      toolConfig({ config: { toolChoice: 'weather' } }, called)?.toolChoice,
      { tool: { name: 'weather' } }
    );
    // A new user message starts a new turn, so the tool is forced again.
    assert.deepEqual(
      toolConfig({ config: { toolChoice: 'time' } }, [
        ...called,
        { role: 'model', content: [{ text: "It's 9am." }] },
        { role: 'user', content: [{ text: 'And now?' }] },
      ])?.toolChoice,
      { tool: { name: 'time' } }
    );
  });

  it("finishes Genkit's tool loop with a named tool", async () => {
    let calls = 0;
    const { client, sent } = fakeClient(() => {
      calls++;
      // Like Bedrock, call the tool whenever it is forced.
      const forced = sent[sent.length - 1].input.toolConfig?.toolChoice?.tool;
      return {
        stopReason: forced ? 'tool_use' : 'end_turn',
        output: {
          message: {
            role: 'assistant',
            content: forced
              ? [
                  {
                    toolUse: {
                      toolUseId: `t${calls}`,
                      name: 'time',
                      input: {},
                    },
                  },
                ]
              : [{ text: "It's 9am." }],
          },
        },
      };
    });
    const ai = genkit({});
    const time = ai.defineTool(
      { name: 'time', description: 'Time', inputSchema: z.object({}) },
      async () => '9am'
    );
    const model = awsBedrockModel('amazon.nova-lite-v1:0', client, 'us');
    ai.registry.registerAction('model', model);
    const res = await ai.generate({
      model: model.__action.name,
      tools: [time],
      prompt: 'What time is it?',
      config: { toolChoice: 'time' },
    });
    assert.equal(res.text, "It's 9am.");
    assert.equal(sent.length, 2);
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
