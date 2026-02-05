# RFC 001: onCallGenkit - AWS Lambda Handler for Genkit Flows

| Status | Accepted |
|--------|----------|
| **RFC #** | 001 |
| **Author** | Xavier Portilla Edo |
| **Created** | 2026-02-04 |
| **Updated** | 2026-02-04 |

## Summary

This RFC proposes the addition of an `onCallGenkit` function to the `genkitx-aws-bedrock` plugin that simplifies deploying Genkit flows as AWS Lambda functions. This feature mirrors the functionality provided by Firebase Functions' `onCallGenkit` helper, bringing the same developer experience to the AWS ecosystem.

## Motivation

### Problem Statement

Currently, deploying a Genkit flow as an AWS Lambda function requires significant boilerplate code:

1. Parsing request bodies and handling base64 encoding
2. Managing CORS headers for cross-origin requests
3. Implementing authentication and authorization logic
4. Formatting responses consistently
5. Handling errors gracefully
6. Managing the Lambda context and event structures

This leads to repetitive code across projects and inconsistent implementations.

### Goals

1. **Simplify Deployment**: Reduce the code required to deploy a Genkit flow as a Lambda function to a single function call
2. **Consistency with Firebase**: Provide a familiar API for developers coming from Firebase Functions
3. **Built-in Best Practices**: Include CORS handling, error management, and authentication out of the box
4. **Type Safety**: Maintain full TypeScript support with proper type inference
5. **Flexibility**: Allow customization of behavior through options while providing sensible defaults

### Non-Goals

1. This RFC does not aim to provide a complete deployment framework (like Serverless Framework or AWS SAM)
2. This RFC does not aim to handle Lambda-specific features like Provisioned Concurrency or Lambda Layers
3. This RFC does not aim to replace the need for infrastructure-as-code tools

## Design

### API Overview

The `onCallGenkit` function accepts a Genkit flow (action) and optionally configuration options, returning a Lambda handler function.

```typescript
// Simple usage
export const handler = onCallGenkit(myFlow);

// With options
export const handler = onCallGenkit(
  {
    cors: { origin: 'https://myapp.com' },
    authPolicy: requireApiKey('X-API-Key', 'secret'),
  },
  myFlow
);
```

### Type Definitions

#### Using Genkit's Flow Type

The implementation imports and uses Genkit's real `Flow` type directly, ensuring full compatibility with Genkit flows:

```typescript
import type { Flow, z } from "genkit";

/**
 * Type helpers to extract input/output types from Flow
 */
type FlowInput<F extends Flow> =
  F extends Flow<infer I, z.ZodTypeAny, z.ZodTypeAny> ? z.infer<I> : never;

type FlowOutput<F extends Flow> =
  F extends Flow<z.ZodTypeAny, infer O, z.ZodTypeAny> ? z.infer<O> : never;

type FlowStream<F extends Flow> =
  F extends Flow<z.ZodTypeAny, z.ZodTypeAny, infer S> ? z.infer<S> : never;
```

These utility types use TypeScript's conditional type inference to extract the input, output, and stream types from a Genkit `Flow`. The `Flow` type from Genkit extends `Action<I, O, S>` and provides the `run()` and `stream()` methods needed for execution.

#### LambdaOptions Interface

```typescript
interface LambdaOptions<T = unknown> {
  cors?: CorsOptions | boolean;
  authPolicy?: (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context,
    data: T,
  ) => boolean | Promise<boolean>;
  enableStreaming?: boolean;
  onError?: (error: Error) => { statusCode: number; message: string } | Promise<{ statusCode: number; message: string }>;
  flowContext?: Record<string, unknown>;
  debug?: boolean;
}
```

#### CorsOptions Interface

```typescript
interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
```

#### Response Types

```typescript
interface FlowResponse<T> {
  success: true;
  data: T;
  flowName: string;
}

interface FlowErrorResponse {
  success: false;
  error: string;
  code?: string;
  flowName?: string;
}
```

### Core Functionality

#### 1. Request Parsing

The handler automatically:
- Parses JSON request bodies
- Handles base64-encoded bodies (common with API Gateway)
- Validates the request format

```typescript
function parseRequestBody<T>(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): T {
  if (!event.body) {
    return {} as T;
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  return JSON.parse(body) as T;
}
```

#### 2. CORS Handling

CORS headers are automatically added based on configuration:

- Default: Allow all origins (`*`)
- Support for single origin, multiple origins, or wildcard
- Automatic handling of preflight OPTIONS requests
- Configurable methods, headers, credentials, and max-age

```typescript
// Preflight handling
if (event.httpMethod === "OPTIONS") {
  return {
    statusCode: 204,
    headers: corsHeaders,
    body: "",
  };
}
```

#### 3. Authorization Policies

The plugin provides composable authorization helpers:

| Helper | Description |
|--------|-------------|
| `allowAll()` | Always allows requests (public endpoints) |
| `requireHeader(name, value?)` | Requires a specific header, optionally with a specific value |
| `requireApiKey(header, key)` | Requires an API key in the specified header |
| `requireBearerToken(validator)` | Requires Bearer token with custom validation |
| `allOf(...policies)` | Combines policies with AND logic |
| `anyOf(...policies)` | Combines policies with OR logic |

Example composition:

```typescript
const policy = allOf(
  requireHeader('X-Client-ID'),
  anyOf(
    requireApiKey('X-API-Key', 'key1'),
    requireBearerToken(validateJWT)
  )
);
```

#### 4. Flow Context Injection

Lambda event and context information is automatically injected into the Genkit flow context:

```typescript
const flowContext = {
  ...opts.flowContext,
  lambda: {
    event: {
      requestContext: event.requestContext,
      headers: event.headers,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
    },
    context: {
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      invokedFunctionArn: context.invokedFunctionArn,
      memoryLimitInMB: context.memoryLimitInMB,
      awsRequestId: context.awsRequestId,
    },
  },
};
```

This allows flows to access Lambda-specific information when needed.

#### 5. Error Handling

Errors are caught and formatted consistently:

- Custom error handler support via `onError` option
- Automatic detection of authentication errors (returns 401)
- All other errors return 500
- Error messages are included in the response

#### 6. Testing Support

The returned handler includes additional properties for testing:

```typescript
interface CallableLambdaFunction<F extends Flow> extends LambdaHandler {
  flow: F;                    // The underlying flow
  run: (input, options?) => Promise<output>;   // Direct execution
  stream: (input, options?) => { stream, output };  // Streaming execution
  flowName: string;           // Flow name for identification
}
```

## Implementation

### File Structure

```
src/
├── aws_lambda.ts      # Main implementation
├── index.ts           # Re-exports
└── ...

examples/
└── lambda/
    ├── src/
    │   └── index.ts   # Example handlers
    ├── serverless.yml # Deployment config
    ├── package.json
    └── README.md
```

### Dependencies

- `@types/aws-lambda` (dev dependency) - Type definitions for AWS Lambda

No runtime dependencies are added beyond what's already in the plugin.

### Exports

The following are exported from the main package:

```typescript
// Functions
export { onCallGenkit, allowAll, requireHeader, requireBearerToken, requireApiKey, allOf, anyOf };

// Types
export type {
  LambdaOptions,
  CorsOptions,
  FlowResponse,
  FlowErrorResponse,
  LambdaFlowResponse,
  LambdaHandler,
  LambdaHandlerV2,
  CallableLambdaFunction,
};
```

## Usage Examples

### Basic Lambda Handler

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock, amazonNovaProV1, onCallGenkit } from 'genkitx-aws-bedrock';

const ai = genkit({
  plugins: [awsBedrock()],
  model: amazonNovaProV1(),
});

const greetFlow = ai.defineFlow(
  {
    name: 'greetFlow',
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ greeting: z.string() }),
  },
  async ({ name }) => {
    const { text } = await ai.generate({ prompt: `Say hello to ${name}` });
    return { greeting: text };
  }
);

export const handler = onCallGenkit(greetFlow);
```

### Protected Endpoint

```typescript
import { onCallGenkit, requireBearerToken } from 'genkitx-aws-bedrock';
import { verifyJWT } from './auth';

export const handler = onCallGenkit(
  {
    authPolicy: requireBearerToken(async (token) => {
      try {
        await verifyJWT(token);
        return true;
      } catch {
        return false;
      }
    }),
    cors: {
      origin: ['https://app.example.com', 'https://staging.example.com'],
      credentials: true,
    },
  },
  protectedFlow
);
```

### With Custom Error Handling

```typescript
export const handler = onCallGenkit(
  {
    onError: async (error) => {
      // Log to monitoring service
      await logToDatadog(error);
      
      // Return user-friendly message
      if (error.message.includes('rate limit')) {
        return { statusCode: 429, message: 'Too many requests. Please try again later.' };
      }
      return { statusCode: 500, message: 'An unexpected error occurred.' };
    },
  },
  myFlow
);
```

### Accessing Lambda Context in Flow

```typescript
const contextAwareFlow = ai.defineFlow(
  {
    name: 'contextAwareFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    const requestId = context?.lambda?.context?.awsRequestId;
    const clientIp = context?.lambda?.event?.requestContext?.identity?.sourceIp;
    
    console.log(`Request ${requestId} from ${clientIp}`);
    
    // ... flow logic
  }
);
```

## Deployment

### With Serverless Framework

```yaml
# serverless.yml
service: my-genkit-service

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1

functions:
  greet:
    handler: src/index.handler
    events:
      - http:
          path: /greet
          method: post
          cors: true
```

### With AWS SAM

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  GreetFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: src/index.handler
      Runtime: nodejs20.x
      Events:
        Api:
          Type: Api
          Properties:
            Path: /greet
            Method: POST
```

### With AWS CDK

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const fn = new lambda.NodejsFunction(this, 'GreetFunction', {
  entry: 'src/index.ts',
  handler: 'handler',
});

const api = new apigateway.RestApi(this, 'GreetApi');
api.root.addResource('greet').addMethod('POST', new apigateway.LambdaIntegration(fn));
```

## References

- [Firebase Functions onCallGenkit](https://github.com/firebase/firebase-functions/blob/master/src/v2/providers/https.ts)
- [Genkit Firebase Deployment Guide](https://genkit.dev/docs/deployment/firebase/)
- [AWS Lambda Handler Types](https://docs.aws.amazon.com/lambda/latest/dg/typescript-handler.html)
- [API Gateway CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [Lambda Response Streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
