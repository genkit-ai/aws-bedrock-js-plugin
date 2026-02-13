# Genkit AWS Lambda Example

An example AWS Lambda function powered by [Genkit](https://genkit.dev/) and the [AWS Bedrock plugin](https://github.com/xavidop/genkitx-aws-bedrock) using the `onCallGenkit` helper for easy deployment.

## Features

- 🚀 Easy Genkit flow deployment with `onCallGenkit`
- 🔐 Built-in authentication policies
- 🌐 Automatic CORS handling
- 📝 Structured error responses
- 📡 Real response streaming via Lambda Function URLs
- 🧪 Local development with Serverless Offline

## Prerequisites

- Node.js 20 or later
- AWS Account with:
  - AWS CLI configured
  - Access to AWS Bedrock (request model access in AWS Console)
- AWS credentials configured (via environment variables or AWS profile)
- Serverless Framework (installed automatically as dev dependency)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Local Development

### Run with Serverless Offline (Recommended for Lambda Testing)

The best way to test the Lambda locally with a real HTTP endpoint:

```bash
npm run dev
```

This starts a local server at `http://localhost:3000` that mimics API Gateway.

### Test the endpoints:

**Story Generator:**
```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "a robot learning to feel emotions",
    "style": "sci-fi",
    "length": "medium"
  }'
```

**Joke Generator:**
```bash
curl -X POST http://localhost:3000/joke \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "programming"
  }'
```

**Protected Flow (with API Key):**
```bash
curl -X POST http://localhost:3000/protected \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-api-key" \
  -d '{
    "text": "Your long text to summarize here...",
    "maxLength": 50
  }'
```

**Streaming Joke Flow (requires deployment with Lambda Function URL):**

> **Note:** Real response streaming only works when deployed to AWS with a Lambda Function URL (`InvokeMode: RESPONSE_STREAM`). It does not work locally with serverless-offline or through API Gateway, which buffer the entire response.

```bash
curl -X POST https://<your-function-url>.lambda-url.us-east-1.on.aws \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "data": {
      "subject": "programming"
    }
  }'
```

### Run with Genkit Dev UI

For testing and debugging the Genkit flow with visual traces:

```bash
npm run genkit:start
```

This starts the Genkit Developer UI at `http://localhost:4000`.

## Using onCallGenkit

The `onCallGenkit` function wraps a Genkit flow to create an AWS Lambda handler with built-in features:

### Basic Usage

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock, amazonNovaProV1, onCallGenkit } from 'genkitx-aws-bedrock';

const ai = genkit({
  plugins: [awsBedrock()],
  model: amazonNovaProV1(),
});

const myFlow = ai.defineFlow(
  {
    name: 'myFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (input) => {
    const { text } = await ai.generate({ prompt: input });
    return text;
  }
);

// Simple handler - just wrap the flow
export const handler = onCallGenkit(myFlow);
```

### Real Response Streaming

`onCallGenkit` also provides a `streamHandler` property for real incremental streaming via Lambda Function URLs.
This is compatible with `streamFlow` from `genkit/beta/client`.

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock, amazonNovaProV1, onCallGenkit } from 'genkitx-aws-bedrock';

const ai = genkit({
  plugins: [awsBedrock()],
  model: amazonNovaProV1(),
});

const myStreamingFlow = ai.defineFlow(
  {
    name: 'myStreamingFlow',
    inputSchema: z.object({ subject: z.string() }),
    outputSchema: z.object({ joke: z.string() }),
    streamSchema: z.string(),
  },
  async (input, sendChunk) => {
    const { stream, response } = await ai.generateStream({
      prompt: `Tell me a joke about ${input.subject}`,
      output: { schema: z.object({ joke: z.string() }) },
    });

    for await (const chunk of stream) {
      sendChunk(chunk.text); // Sends SSE events incrementally
    }

    const result = await response;
    return result.output || { joke: result.text };
  }
);

// Use .streamHandler for Lambda Function URL deployment
export const streamingHandler = onCallGenkit(
  { cors: { origin: '*' } },
  myStreamingFlow
).streamHandler;
```

To deploy a streaming handler, configure serverless.yml with a Lambda Function URL:

```yaml
functions:
  myStreamingFunction:
    handler: src/index.streamingHandler
    url:
      invokeMode: RESPONSE_STREAM
      cors: true
```

> **Important:** API Gateway buffers the entire response, so streaming does not work through API Gateway. You must use a [Lambda Function URL](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html) with `InvokeMode: RESPONSE_STREAM` for real incremental streaming.

### With Options

```typescript
export const handler = onCallGenkit(
  {
    // CORS configuration
    cors: {
      origin: 'https://myapp.com',
      credentials: true,
    },
    
    // Authorization policy
    authPolicy: requireApiKey('X-API-Key', 'secret-key'),
    
    // Enable debug logging
    debug: true,
    
    // Custom error handling
    onError: async (error) => ({
      statusCode: 500,
      message: error.message,
    }),
  },
  myFlow
);
```

### Authentication Policies

The package provides several built-in authentication helpers:

```typescript
import {
  onCallGenkit,
  allowAll,           // Allow all requests
  requireHeader,      // Require a specific header
  requireApiKey,      // Require API key in header
  requireBearerToken, // Require Bearer token
  allOf,              // Combine policies with AND
  anyOf,              // Combine policies with OR
} from 'genkitx-aws-bedrock';

// Allow all requests
export const publicHandler = onCallGenkit({ authPolicy: allowAll() }, myFlow);

// Require API key
export const apiKeyHandler = onCallGenkit(
  { authPolicy: requireApiKey('X-API-Key', 'my-secret') },
  myFlow
);

// Require Bearer token with custom validation
export const tokenHandler = onCallGenkit(
  {
    authPolicy: requireBearerToken(async (token) => {
      return await validateJWT(token);
    })
  },
  myFlow
);

// Combine policies
export const strictHandler = onCallGenkit(
  {
    authPolicy: allOf(
      requireHeader('X-Client-ID'),
      requireBearerToken(validateToken)
    )
  },
  myFlow
);
```

## Deployment

### Quick Deploy

Deploy to AWS with a single command:

```bash
npm run deploy
```

This deploys to the `dev` stage by default.

### Deploy to Production

```bash
npm run deploy:prod
```

### View Deployment Info

```bash
npm run info
```

### View Live Logs

```bash
npm run logs
```

### Remove Deployment

```bash
npm run remove
```

## Response Format

The handler follows the Genkit callable protocol (same as `@genkit-ai/express`).

### Request

```json
{
  "data": { /* flow input */ }
}
```

### Success Response

```json
{
  "result": { /* flow output */ }
}
```

### Error Response

```json
{
  "error": {
    "status": "UNAUTHENTICATED",
    "message": "Missing auth token"
  }
}
```

### Streaming Response (SSE)

When using `streamHandler` with `Accept: text/event-stream`, the response is a stream of SSE events:

```
data: {"message": "chunk text"}

data: {"message": "more text"}

data: {"result": {"joke": "full result"}}
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Lambda handlers and Genkit flows
├── serverless.yml        # Serverless Framework configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Deployment URLs

After deployment, you will see two types of URLs:

| Type | URL Pattern | Used For |
|------|-------------|----------|
| API Gateway | `*.execute-api.*.amazonaws.com/dev/*` | Standard request/response flows |
| Lambda Function URL | `*.lambda-url.*.on.aws` | Streaming flows (`RESPONSE_STREAM`) |

API Gateway endpoints support path routing (e.g., `/dev/joke`, `/dev/generate`), while Lambda Function URLs are a single endpoint per function.

## Configuration

### Switching Bedrock Models

Edit `src/index.ts` to use different Bedrock models:

```typescript
import { awsBedrock, anthropicClaude35SonnetV2 } from 'genkitx-aws-bedrock';

const ai = genkit({
  plugins: [awsBedrock({ region: 'us-east-1' })],
  model: anthropicClaude35SonnetV2('us'),
});
```

### Adjusting Lambda Resources

Edit `serverless.yml` to change Lambda configuration:

```yaml
provider:
  memorySize: 512    # Increase for better performance
  timeout: 60        # Increase for longer generations
```

## Environment Variables

- `API_KEY` - API key for protected endpoints (default: 'demo-api-key')
- `NODE_ENV` - Environment (development/production)

## Learn More

- [Genkit Documentation](https://genkit.dev/docs/)
- [AWS Bedrock Plugin](https://github.com/xavidop/genkitx-aws-bedrock)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [AWS Bedrock](https://aws.amazon.com/bedrock/)

## License

Apache-2.0
