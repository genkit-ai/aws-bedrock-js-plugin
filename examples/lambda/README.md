# Genkit AWS Lambda Example

An example AWS Lambda function powered by [Firebase Genkit](https://genkit.dev/) and the [AWS Bedrock plugin](https://github.com/xavidop/genkitx-aws-bedrock) using the `onCallGenkit` helper for easy deployment.

## Features

- 🚀 Easy Genkit flow deployment with `onCallGenkit`
- 🔐 Built-in authentication policies
- 🌐 Automatic CORS handling
- 📝 Structured error responses
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

### Success Response

```json
{
  "success": true,
  "data": {
    // Flow output data
  },
  "flowName": "storyGeneratorFlow"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "flowName": "storyGeneratorFlow"
}
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

- [Firebase Genkit Documentation](https://genkit.dev/docs/)
- [AWS Bedrock Plugin](https://github.com/xavidop/genkitx-aws-bedrock)
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [AWS Bedrock](https://aws.amazon.com/bedrock/)

## License

Apache-2.0
