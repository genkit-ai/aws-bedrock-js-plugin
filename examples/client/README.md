# Genkit Client Example

Demonstrates how to use the [Genkit client library](https://genkit.dev/docs/client/) to call flows deployed on AWS Lambda using `onCallGenkit`.

## Prerequisites

- The **lambda** example deployed or running locally (see [../lambda/README.md](../lambda/README.md))
- Node.js 20 or later

## Installation

```bash
npm install
```

## Usage

### 1. Start the Lambda locally (in another terminal)

```bash
cd ../lambda
npm install && npm run build
npm run dev
# Server starts at http://localhost:3000
```

### 2. Run the client

```bash
# Call the joke flow (default)
npm run dev

# Call a specific flow
npm run dev -- joke
npm run dev -- story
npm run dev -- protected
npm run dev -- stream
npm run dev -- all
```

### Targeting a deployed Lambda

After deploying the Lambda example, you will see two types of URLs:

- **API Gateway** (`*.execute-api.*.amazonaws.com/dev/*`) — for standard request/response flows
- **Lambda Function URL** (`*.lambda-url.*.on.aws`) — for streaming flows (uses `RESPONSE_STREAM` invoke mode)

Set the corresponding environment variables:

```bash
# API Gateway URL for standard flows
LAMBDA_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev

# Lambda Function URL for streaming (printed separately in deploy output)
LAMBDA_STREAM_URL=https://xyz.lambda-url.us-east-1.on.aws
```

Run all examples:

```bash
LAMBDA_BASE_URL=https://abc123.execute-api.us-east-1.amazonaws.com/dev \
  LAMBDA_STREAM_URL=https://xyz.lambda-url.us-east-1.on.aws \
  npm run dev -- all
```

### Protected flow

The protected flow requires an API key:

```bash
API_KEY=my-secret-key npm run dev -- protected
```

## Available Examples

| Command | Description |
|---------|-------------|
| `joke` | Simple joke generation flow (no auth) |
| `story` | Story generator with topic, style, and length |
| `protected` | Summary flow protected with API key (`X-API-Key` header) |
| `stream` | Joke flow with real response streaming via Lambda Function URL |
| `all` | Runs joke, story, protected, and stream sequentially |

### Streaming flow

The streaming example uses `streamFlow` from `genkit/beta/client` and requires a **Lambda Function URL** with `InvokeMode: RESPONSE_STREAM` (not API Gateway, which buffers the entire response).

After deploying the lambda example, the Function URL is printed separately in the deploy output:

```
jokeStream: https://abc123.lambda-url.us-east-1.on.aws/
```

Run the streaming example:

```bash
LAMBDA_STREAM_URL=https://abc123.lambda-url.us-east-1.on.aws \
  LAMBDA_BASE_URL=https://xyz.execute-api.us-east-1.amazonaws.com/dev \
  npm run dev -- stream
```

## How It Works

The Genkit client uses the callable protocol over HTTP to communicate with flows deployed via `onCallGenkit`. The `runFlow` function sends a POST request with the input wrapped in the expected format and returns the parsed result.

```typescript
import { runFlow, streamFlow } from 'genkit/beta/client';

const result = await runFlow({
  url: 'http://localhost:3000/joke',
  input: { subject: 'programming' },
});
```

For authenticated flows, pass custom headers:

```typescript
const result = await runFlow({
  url: 'http://localhost:3000/protected',
  input: { text: '...' },
  headers: {
    'X-API-Key': 'your-api-key',
  },
});
```

For streaming responses, use `streamFlow` with a Lambda Function URL configured for response streaming:

```typescript
// Requires Lambda deployed with InvokeMode: RESPONSE_STREAM
const result = streamFlow({
  url: 'https://abc123.lambda-url.us-east-1.on.aws',
  input: { subject: 'TypeScript' },
});

for await (const chunk of result.stream) {
  console.log('Stream chunk:', chunk);
}

const finalOutput = await result.output;
```
