<h1 align="center">
  Genkit <> AWS Bedrock Plugin
</h1>

<h4 align="center">AWS Bedrock Community Plugin for Google Genkit</h4>

<div align="center">
   <img alt="GitHub version" src="https://img.shields.io/github/v/release/genkit-ai/aws-bedrock-js-plugin">
   <img alt="NPM Downloads" src="https://img.shields.io/npm/dw/genkitx-aws-bedrock">
   <img alt="GitHub License" src="https://img.shields.io/github/license/genkit-ai/aws-bedrock-js-plugin">
   <img alt="Static Badge" src="https://img.shields.io/badge/yes-a?label=maintained">
</div>

<div align="center">
   <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/genkit-ai/aws-bedrock-js-plugin?color=blue">
   <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues-pr/genkit-ai/aws-bedrock-js-plugin?color=blue">
   <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/genkit-ai/aws-bedrock-js-plugin">
</div>

</br>

**`genkitx-aws-bedrock`** is a community plugin for using AWS Bedrock APIs with
[Genkit](https://github.com/firebase/genkit). Built by [**Xavier Portilla Edo**](https://github.com/xavidop).

This Genkit plugin allows to use AWS Bedrock through their official APIs.

## Installation

Install the plugin in your project with your favourite package manager

- `npm install genkitx-aws-bedrock`
- `pnpm add genkitx-aws-bedrock`

### Versions

if you are using Genkit version `<v0.9.0`, please use the plugin version `v1.9.0`. If you are using Genkit `>=v0.9.0`, please use the plugin version `>=v1.10.0`.

## Usage

### Configuration

To use the plugin, you need to configure it with your AWS credentials. There are several approaches depending on your environment.

#### Standard Initialization

You can configure the plugin by calling the `genkit` function with your AWS region and model:

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock, amazonNovaProV1 } from "genkitx-aws-bedrock";

const ai = genkit({
  plugins: [
    awsBedrock({ region: "<my-region>" }),
  ],
   model: amazonNovaProV1,
});
```

If you have set the `AWS_` environment variables, you can initialize it like this:

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock, amazonNovaProV1 } from "genkitx-aws-bedrock";

const ai = genkit({
  plugins: [
    awsBedrock(),
  ],
   model: amazonNovaProV1,
});
```

#### Production Environment Authentication

In production environments, it is often necessary to install an additional library to handle authentication. One approach is to use the `@aws-sdk/credential-providers` package:

```typescript
import { fromEnv } from "@aws-sdk/credential-providers";
const ai = genkit({
  plugins: [
    awsBedrock({
      region: "us-east-1",
      credentials: fromEnv(),
    }),
  ],
});
```

Ensure you have a `.env` file with the necessary AWS credentials. Remember that the .env file must be added to your .gitignore to prevent sensitive credentials from being exposed.

```
AWS_ACCESS_KEY_ID = 
AWS_SECRET_ACCESS_KEY =
```

#### Local Environment Authentication

For local development, you can directly supply the credentials:

```typescript
const ai = genkit({
  plugins: [
    awsBedrock({
      region: "us-east-1",
      credentials: {
        accessKeyId: awsAccessKeyId.value(),
        secretAccessKey: awsSecretAccessKey.value(),
      },
    }),
  ],
});
```

Each approach allows you to manage authentication effectively based on your environment needs. 


### Configuration with Inference Endpoint

If you want to use a model that uses [Cross-region Inference Endpoints](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html), you can specify the region in the model configuration. Cross-region inference uses inference profiles to increase throughput and improve resiliency by routing your requests across multiple AWS Regions during peak utilization bursts:


```typescript
import { genkit, z } from 'genkit';
import {awsBedrock, amazonNovaProV1, anthropicClaude35SonnetV2} from "genkitx-aws-bedrock";

const ai = genkit({
  plugins: [
    awsBedrock(),
  ],
   model: anthropicClaude35SonnetV2("us"),
});
```

You can check more information about the available models in the [AWS Bedrock PLugin documentation](https://xavidop.github.io/genkitx-aws-bedrock/).

### Basic examples

The simplest way to call the text generation model is by using the helper function `generate`:

```typescript
import { genkit, z } from 'genkit';
import {awsBedrock, amazonNovaProV1} from "genkitx-aws-bedrock";

// Basic usage of an LLM
const response = await ai.generate({
  prompt: 'Tell me a joke.',
});

console.log(await response.text);
```

### Within a flow

```typescript
// ...configure Genkit (as shown above)...

export const myFlow = ai.defineFlow(
  {
    name: 'menuSuggestionFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const llmResponse = await ai.generate({
      prompt: `Suggest an item for the menu of a ${subject} themed restaurant`,
    });

    return llmResponse.text;
  }
);
```

### Tool use

```typescript
// ...configure Genkit (as shown above)...

const specialToolInputSchema = z.object({ meal: z.enum(["breakfast", "lunch", "dinner"]) });
const specialTool = ai.defineTool(
  {
    name: "specialTool",
    description: "Retrieves today's special for the given meal",
    inputSchema: specialToolInputSchema,
    outputSchema: z.string(),
  },
  async ({ meal }): Promise<string> => {
    // Retrieve up-to-date information and return it. Here, we just return a
    // fixed value.
    return "Baked beans on toast";
  }
);

const result = ai.generate({
  tools: [specialTool],
  prompt: "What's for breakfast?",
});

console.log(result.then((res) => res.text));
```

For more detailed examples and the explanation of other functionalities, refer to the [official Genkit documentation](https://genkit.dev/).

## Using Custom Models

If you want to use a model that is not exported by this plugin, you can register it using the `customModels` option when initializing the plugin:

```typescript
import { genkit, z } from 'genkit';
import { awsBedrock } from 'genkitx-aws-bedrock';

const ai = genkit({
  plugins: [
    awsBedrock({
      region: 'us-east-1',
      customModels: ['openai.gpt-oss-20b-1:0'], // Register custom models
    }),
  ],
});

// Use the custom model by specifying its name as a string
export const customModelFlow = ai.defineFlow(
  {
    name: 'customModelFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const llmResponse = await ai.generate({
      model: 'aws-bedrock/openai.gpt-oss-20b-1:0', // Use any registered custom model
      prompt: `Tell me about ${subject}`,
    });
    return llmResponse.text;
  }
);
```

Alternatively, you can define a custom model outside of the plugin initialization:

```typescript
import { defineAwsBedrockModel } from 'genkitx-aws-bedrock';

const customModel = defineAwsBedrockModel('openai.gpt-oss-20b-1:0', {
  region: 'us-east-1'
});

const response = await ai.generate({
  model: customModel,
  prompt: 'Hello!'
});
```

## Deploying Genkit Flows as AWS Lambda Functions

This plugin includes an `onCallGenkit` helper function (similar to Firebase Functions' `onCallGenkit`) that makes it easy to deploy Genkit flows as AWS Lambda functions.

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

// Export as Lambda handler
export const handler = onCallGenkit(myFlow);
```

### Response Streaming

`onCallGenkit` also provides a `streamHandler` for real incremental streaming via [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html). This is compatible with `streamFlow` from `genkit/beta/client`.

```typescript
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
      sendChunk(chunk.text);
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

Deploy with a Lambda Function URL in `serverless.yml`:

```yaml
functions:
  myStreamingFunction:
    handler: src/index.streamingHandler
    url:
      invokeMode: RESPONSE_STREAM
      cors: true
```

> **Note:** API Gateway buffers responses and does not support streaming. You must use a Lambda Function URL with `InvokeMode: RESPONSE_STREAM`.

### With Configuration Options

```typescript
import { onCallGenkit, requireApiKey } from 'genkitx-aws-bedrock';

export const handler = onCallGenkit(
  {
    // CORS configuration
    cors: {
      origin: 'https://myapp.com',
      credentials: true,
    },
    // Context provider for authentication
    contextProvider: requireApiKey('X-API-Key', process.env.API_KEY!),
    // Debug logging
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

### Context Providers for Authentication

The plugin provides built-in context provider helpers that follow Genkit's `ContextProvider` pattern (same as `@genkit-ai/express`):

```typescript
import {
  allowAll,           // Allow all requests
  requireHeader,      // Require a specific header
  requireApiKey,      // Require API key in header
  requireBearerToken, // Require Bearer token with custom validation
  allOf,              // Combine providers with AND logic
  anyOf,              // Combine providers with OR logic
} from 'genkitx-aws-bedrock';

// Public endpoint
export const publicHandler = onCallGenkit(
  { contextProvider: allowAll() },
  myFlow
);

// API key authentication
export const apiKeyHandler = onCallGenkit(
  { contextProvider: requireApiKey('X-API-Key', 'my-secret-key') },
  myFlow
);

// Bearer token with custom validation
export const tokenHandler = onCallGenkit(
  {
    contextProvider: requireBearerToken(async (token) => {
      const user = await validateJWT(token);
      return { auth: { user } };
    })
  },
  myFlow
);

// Combine multiple providers (all must pass)
export const strictHandler = onCallGenkit(
  {
    contextProvider: allOf(
      requireHeader('X-Client-ID'),
      requireBearerToken(async (token) => {
        return await validateToken(token);
      })
    )
  },
  myFlow
);
```

### Request & Response Format

The handler follows the Genkit callable protocol (same as `@genkit-ai/express`).

Request body (callable protocol):
```json
{
  "data": { /* flow input */ }
}
```

Direct input is also supported for convenience:
```json
{ /* flow input directly */ }
```

Successful response:
```json
{
  "result": { /* flow output */ }
}
```

Error response:
```json
{
  "error": {
    "status": "UNAUTHENTICATED",
    "message": "Missing auth token"
  }
}
```

Streaming response (SSE, via `streamHandler`):
```
data: {"message": "chunk text"}

data: {"message": "more text"}

data: {"result": {"joke": "full result"}}
```

See the [Lambda example](./examples/lambda) for a complete working project with Serverless Framework deployment, and the [Client example](./examples/client) for calling flows from a TypeScript client.

## Supported models

This plugin supports all currently available **Chat/Completion** and **Embeddings** models from AWS Bedrock. This plugin supports image input and multimodal models.

## API Reference

You can find the full API reference in the [API Reference Documentation](https://xavidop.github.io/genkitx-aws-bedrock/)

## Contributing

Want to contribute to the project? That's awesome! Head over to our [Contribution Guidelines](https://github.com/genkit-ai/aws-bedrock-js-plugin/blob/main/CONTRIBUTING.md).

## Need support?

> [!NOTE]  
> This repository depends on Google's Genkit. For issues and questions related to Genkit, please refer to instructions available in [Genkit's repository](https://github.com/firebase/genkit).

Reach out by opening a discussion on [GitHub Discussions](https://github.com/genkit-ai/aws-bedrock-js-plugin/discussions).

## License

This project is licensed under the [Apache 2.0 License](https://github.com/genkit-ai/aws-bedrock-js-plugin/blob/main/LICENSE).

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202%2E0-lightgrey.svg)](https://github.com/genkit-ai/aws-bedrock-js-plugin/blob/main/LICENSE)
