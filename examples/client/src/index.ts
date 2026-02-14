/**
 * Copyright 2026 Xavier Portilla Edo
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
 * Genkit Client Example
 *
 * Demonstrates how to use the Genkit client library to call flows deployed
 * on AWS Lambda using onCallGenkit.
 *
 * Usage:
 *   1. Deploy the lambda example first (see ../lambda/README.md)
 *   2. Set LAMBDA_BASE_URL to your API Gateway / Lambda Function URL
 *   3. Run: npm run dev
 *
 * @see https://genkit.dev/docs/client/
 */

import { runFlow, streamFlow } from 'genkit/beta/client';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Base URL of your deployed Lambda (API Gateway or Lambda Function URL).
 * For local testing with serverless-offline, use http://localhost:3000
 */
const BASE_URL = process.env.LAMBDA_BASE_URL || 'http://localhost:3000';

/**
 * Lambda Function URL for the streaming endpoint.
 * Required for real response streaming (InvokeMode: RESPONSE_STREAM).
 * This is a separate URL from the API Gateway endpoint.
 */
const STREAM_URL = process.env.LAMBDA_STREAM_URL || '';

// ============================================================================
// Examples
// ============================================================================

/**
 * Example 1: Call the joke flow (simple, no auth)
 */
async function callJokeFlow() {
  console.log('\n--- Joke Flow ---');
  console.log(`Calling ${BASE_URL}/joke ...`);

  const result = await runFlow({
    url: `${BASE_URL}/joke`,
    input: { subject: 'programming' },
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Example 2: Call the story generator flow
 */
async function callStoryGeneratorFlow() {
  console.log('\n--- Story Generator Flow ---');
  console.log(`Calling ${BASE_URL}/generate ...`);

  const result = await runFlow({
    url: `${BASE_URL}/generate`,
    input: {
      topic: 'a robot learning to feel emotions',
      style: 'sci-fi',
      length: 'short',
    },
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Example 3: Call a protected flow with API key header
 */
async function callProtectedFlow() {
  console.log('\n--- Protected Summary Flow (with API Key) ---');
  console.log(`Calling ${BASE_URL}/protected ...`);

  const apiKey = process.env.API_KEY || 'demo-api-key';

  const result = await runFlow({
    url: `${BASE_URL}/protected`,
    input: {
      text: 'Artificial intelligence has transformed the way we interact with technology. From virtual assistants to autonomous vehicles, AI systems are becoming increasingly integrated into our daily lives. Machine learning, a subset of AI, enables computers to learn from data without being explicitly programmed. Deep learning, which uses neural networks with many layers, has achieved remarkable results in image recognition, natural language processing, and game playing.',
      maxLength: 50,
    },
    headers: {
      'X-API-Key': apiKey,
    },
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Example 4: Call a flow with real streaming using streamFlow
 * Requires a Lambda Function URL with InvokeMode: RESPONSE_STREAM
 */
async function callJokeFlowStreaming() {
  if (!STREAM_URL) {
    console.error(
      'Set LAMBDA_STREAM_URL to your Lambda Function URL for the streaming endpoint.\n' +
      'Example: LAMBDA_STREAM_URL=https://abc123.lambda-url.us-east-1.on.aws npm run dev -- stream',
    );
    process.exit(1);
  }

  console.log('\n--- Joke Flow (Streaming) ---');
  console.log(`Calling ${STREAM_URL} with streaming ...`);

  const result = streamFlow({
    url: STREAM_URL,
    input: { subject: 'TypeScript' },
  });

  // Process the stream chunks as they arrive
  for await (const chunk of result.stream) {
    console.log('Stream chunk:', chunk);
  }

  // Get the final complete response
  const finalOutput = await result.output;
  console.log('Final result:', JSON.stringify(finalOutput, null, 2));
  return finalOutput;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Genkit Client Example ===');
  console.log(`Target: ${BASE_URL}`);
  console.log('Make sure the Lambda example is running (npm run dev in ../lambda)');

  const args = process.argv.slice(2);
  const example = args[0] || 'joke';

  try {
    switch (example) {
      case 'joke':
        await callJokeFlow();
        break;
      case 'story':
        await callStoryGeneratorFlow();
        break;
      case 'protected':
        await callProtectedFlow();
        break;
      case 'stream':
        await callJokeFlowStreaming();
        break;
      case 'all':
        await callJokeFlow();
        await callStoryGeneratorFlow();
        await callProtectedFlow();
        await callJokeFlowStreaming();
        break;
      default:
        console.log(`Unknown example: ${example}`);
        console.log('Available: joke, story, protected, stream, all');
        process.exit(1);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('\nError calling flow:', err.message || error);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
    process.exit(1);
  }
}

main();
