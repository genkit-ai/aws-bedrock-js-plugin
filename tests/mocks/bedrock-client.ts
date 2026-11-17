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

import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

/** A command the fake client received: its class name and input. */
export interface SentCommand {
  name: string;
  input: any;
}

/**
 * Returns a stand-in for BedrockRuntimeClient that records every command it
 * is sent and answers with `reply(command)`.
 */
export function fakeClient(reply: (command: SentCommand) => unknown) {
  const sent: SentCommand[] = [];
  const client = {
    async send(command: { constructor: { name: string }; input: unknown }) {
      const c = { name: command.constructor.name, input: command.input };
      sent.push(c);
      return reply(c);
    },
  } as unknown as BedrockRuntimeClient;
  return { client, sent };
}

/** Wraps ConverseStream events in the shape the SDK returns. */
export function streamOf(events: unknown[]) {
  return {
    stream: (async function* () {
      for (const e of events) yield e;
    })(),
  };
}

/** Encodes a JSON value as an InvokeModel response body. */
export function jsonBody(value: unknown) {
  return { body: new TextEncoder().encode(JSON.stringify(value)) };
}
