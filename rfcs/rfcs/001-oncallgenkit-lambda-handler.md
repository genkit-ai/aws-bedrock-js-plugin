# RFC 001: onCallGenkit - AWS Lambda Handler for Genkit Flows

| Status | Accepted |
|--------|----------|
| **RFC #** | 001 |
| **Author** | Xavier Portilla Edo |
| **Created** | 2026-02-04 |
| **Updated** | 2026-02-06 |

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

// With options and ContextProvider for auth
export const handler = onCallGenkit(
  {
    cors: { origin: 'https://myapp.com' },
    contextProvider: requireApiKey('X-API-Key', 'secret'),
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

The options interface uses Genkit's `ContextProvider` type, aligning with Express, Next.js, and other Genkit integrations:

```typescript
import type { ContextProvider, RequestData, ActionContext } from 'genkit/context';

interface LambdaOptions<C extends ActionContext = ActionContext, T = unknown> {
  cors?: CorsOptions | boolean;
  contextProvider?: ContextProvider<C, T>;
  enableStreaming?: boolean;
  onError?: (error: Error) => { statusCode: number; message: string } | Promise<{ statusCode: number; message: string }>;
  debug?: boolean;
}
```

#### ContextProvider Pattern

The `contextProvider` option follows the same pattern used in `@genkit-ai/express` and other Genkit HTTP adapters. A `ContextProvider` is a function that:

1. Receives a `RequestData` object with headers, method, and parsed input
2. Returns an `ActionContext` that will be available in the flow via `getContext()`
3. Throws `UserFacingError` for authentication/authorization failures

```typescript
// RequestData provides a normalized view of the request
interface RequestData<T = any> {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'QUERY';
  headers: Record<string, string>;  // Lowercase headers
  input: T;
}

// ContextProvider returns context for the flow
type ContextProvider<C extends ActionContext, T> = 
  (request: RequestData<T>) => C | Promise<C>;
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

#### Response Types (Callable Protocol)

Responses follow the Genkit callable protocol, matching the format used by `@genkit-ai/express` and other Genkit HTTP adapters:

```typescript
// Success response
interface FlowResponse<T> {
  result: T;
}

// Error response (matches getCallableJSON output from genkit/context)
interface FlowErrorResponse {
  error: {
    status: string;
    message: string;
    details?: unknown;
  };
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

  const parsed = JSON.parse(body);
  // Support callable protocol: { data: <input> }
  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return parsed.data as T;
  }
  return parsed as T;
}
```

This supports both the Genkit callable protocol format (`{ "data": { ... } }`) and direct input for convenience.

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

#### 3. ContextProvider Helpers

The plugin provides composable context provider helpers that follow Genkit's patterns:

| Helper | Description |
|--------|-------------|
| `allowAll()` | Returns empty context (public endpoints) |
| `requireHeader(name, value?)` | Requires a header, throws `UserFacingError` if missing |
| `requireApiKey(header, keyOrValidator)` | Requires API key, returns `ApiKeyContext` |
| `requireBearerToken(validator)` | Requires Bearer token, validator returns context |
| `allOf(...providers)` | Combines providers, merges returned contexts |
| `anyOf(...providers)` | Tries providers in order, returns first success |

Example composition:

```typescript
import { UserFacingError } from 'genkit';
import type { ContextProvider } from 'genkit/context';

// Custom context provider with validation
interface AuthContext {
  auth: { user: { id: string; name: string } };
}

const authProvider: ContextProvider<AuthContext> = async (req) => {
  const token = req.headers['authorization'];
  if (!token) {
    throw new UserFacingError('UNAUTHENTICATED', 'Missing auth token');
  }
  const user = await verifyToken(token);
  return { auth: { user } };
};

// Using built-in helpers
const combined = allOf(
  requireHeader('X-Request-ID'),
  requireApiKey('X-API-Key', process.env.API_KEY!)
);

// Accept multiple auth methods
const flexibleAuth = anyOf(
  requireApiKey('X-API-Key', process.env.API_KEY!),
  requireBearerToken(async (token) => {
    const user = await verifyJWT(token);
    return { auth: { user } };
  })
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

Errors are handled using Genkit's `getCallableJSON` and `getHttpStatus` utilities from `genkit/context`, matching the Express handler behavior:

- `UserFacingError` instances are converted to proper HTTP status codes via `getHttpStatus()`
- Error responses follow the callable protocol format via `getCallableJSON()`
- Custom error handler support via `onError` option (checked first if provided)
- All errors produce consistent, client-friendly error objects

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
  // Lambda types
  LambdaOptions,
  CorsOptions,
  FlowResponse,
  FlowErrorResponse,
  LambdaFlowResponse,
  LambdaHandler,
  LambdaHandlerV2,
  CallableLambdaFunction,
  LambdaActionContext,
  // Re-exported from genkit/context for convenience
  ContextProvider,
  RequestData,
  ActionContext,
  // Context types for built-in helpers
  ApiKeyContext,
  BearerTokenContext,
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

### Protected Endpoint with ContextProvider

```typescript
import { UserFacingError } from 'genkit';
import { onCallGenkit, requireBearerToken } from 'genkitx-aws-bedrock';
import { verifyJWT } from './auth';

// The context provider validates the token and returns user context
export const handler = onCallGenkit(
  {
    contextProvider: requireBearerToken(async (token) => {
      const user = await verifyJWT(token);
      if (!user) {
        throw new UserFacingError('PERMISSION_DENIED', 'Invalid token');
      }
      return { auth: { user } };
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

### Accessing Context in Flow

Context from both the ContextProvider and Lambda-specific data is available:

```typescript
import { getContext } from 'genkit';
import type { LambdaActionContext } from 'genkitx-aws-bedrock';

interface MyContext extends LambdaActionContext {
  auth: { user: { id: string; name: string } };
}

const contextAwareFlow = ai.defineFlow(
  {
    name: 'contextAwareFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (input, { context }) => {
    // Access auth context from ContextProvider
    const user = (context as MyContext).auth?.user;
    console.log(`User: ${user?.name}`);
    
    // Access Lambda-specific context
    const requestId = context?.lambda?.context?.awsRequestId;
    const headers = context?.lambda?.event?.headers;
    
    console.log(`Request ${requestId}`);
    
    // Or use getContext() anywhere in the call stack
    const ctx = getContext<MyContext>();
    
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
