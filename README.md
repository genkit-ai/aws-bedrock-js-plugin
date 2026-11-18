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

This Genkit plugin allows the use of AWS Bedrock through their official APIs.

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

#### Tool choice

Genkit's `toolChoice` is passed to Bedrock: `'auto'` lets the model decide, `'required'` makes it call a tool, and `'none'` sends no tools. To make the model call one specific tool, name it in `config.toolChoice`:

```typescript
const result = await ai.generate({
  tools: [specialTool],
  prompt: "What's for breakfast?",
  config: { toolChoice: 'specialTool' },
});
```

`'required'` and the named tool are forced only until a tool result (the named tool's, for a named choice) is in the conversation after the last user message. After that the choice is `auto`, so the model can answer with the tool's result instead of being forced to call a tool again on every turn of Genkit's tool loop.

Bedrock accepts a forced choice (`'required'` or a named tool) only on some models, and the plugin declares `supports.toolChoice` for exactly those: Anthropic Claude 3 and later, Amazon Nova and Mistral Large. Other models (Llama, Cohere Command, AI21, Gemma, the other Mistral models) and models the plugin doesn't know are not declared, so Genkit warns that they don't support `toolChoice`, and the plugin sends their tools with no `toolChoice`. Bedrock's default is `auto`, so tools still work there; `'required'` and named choices just aren't enforced. Converse has no "none" choice, and it rejects tool calls and results in the conversation unless tools are sent. So with `'none'`, earlier tool calls and results are sent to the model as text, and no tools are sent: the model sees what was called and returned but can't call a tool.

### Structured Output

In order to use [Genkit structured output](https://genkit.dev/docs/js/models/#structured-output) with the Bedrock APIs, the schema sent to Bedrock needs to have `additionalProperties` set to false. If you have your schemas defined as `zod` schemas you can use `zodToJsonSchema` along with `schema.strict()` to get it in the correct format

```typescript
// ...configure Genkit (as shown above)...

import { zodToJsonSchema } from 'zod-to-json-schema';

const outputSchema = z.object({
    joke: z.string()
});
const structuredOutputSchema = zodToJsonSchema(
    outputSchema.strict()
);

// Results in an error:
// output_config.format.schema: For 'object' type, 'additionalProperties: true' is not supported. Please set 'additionalProperties' to false
const response = await ai.generate({
  prompt: 'Tell me a joke.',
  output: {
    schema: outputSchema
  }
});

// Works correctly!
const response = await ai.generate({
  prompt: 'Tell me a joke.',
  output: {
    format: 'json',
    jsonSchema: structuredOutputSchema
  }
});
```

### Per-call configuration

Every model accepts Genkit's common config (`temperature`, `maxOutputTokens`, `topP`, `stopSequences`) plus these Converse request fields:

| Field | What it does |
|---|---|
| `additionalModelRequestFields` | Model-specific fields, such as Claude `thinking` or Nova `inferenceConfig.topK` |
| `additionalModelResponseFieldPaths` | JSON pointers to model-specific response fields to return |
| `guardrailConfig` | A Bedrock guardrail: `guardrailIdentifier`, `guardrailVersion`, `trace`, and `streamProcessingMode` when streaming |
| `performanceConfig` | `{ latency: 'optimized' }` for latency-optimized inference |
| `serviceTier` | `'default'`, `'priority'`, `'flex'` or `'reserved'` |
| `requestMetadata` | String key-value pairs logged with the request |

```typescript
const response = await ai.generate({
  model: anthropicClaudeSonnet45V1('us'),
  prompt: 'Prove that there are infinitely many primes.',
  config: {
    maxOutputTokens: 4096,
    additionalModelRequestFields: {
      thinking: { type: 'enabled', budget_tokens: 2048 },
    },
    guardrailConfig: { guardrailIdentifier: 'my-guardrail', guardrailVersion: '1' },
  },
});
```

The schema is exported as `AwsBedrockConfigSchema`.

### Reasoning

Turn on extended thinking through `additionalModelRequestFields` (for Claude, `thinking`). The model's reasoning comes back as `reasoning` parts, streamed as it is generated, and `response.text` leaves it out:

```typescript
const response = await ai.generate({
  model: anthropicClaudeSonnet45V1('us'),
  prompt: 'What is 17 * 23?',
  config: {
    maxOutputTokens: 4096,
    additionalModelRequestFields: { thinking: { type: 'enabled', budget_tokens: 1024 } },
  },
});
console.log(response.reasoning); // the model's thinking
console.log(response.text); // the answer
```

Claude signs its reasoning and sometimes redacts it, and rejects a follow-up turn unless that reasoning is sent back unchanged. The plugin keeps the signature in the part's `metadata.bedrockReasoningSignature` and redacted reasoning in `metadata.bedrockRedactedContent`, and sends both back when the message is in the history. This matters for tool calls with thinking turned on. Reasoning from other providers has no signature, so it is not sent to Bedrock.

### Prompt caching

Mark a part with `metadata.cachePoint` to put a Bedrock cache point after it. Use `true` for the default cache point, or `{ ttl: '1h' }` to set the TTL on models that support it. Cache points work in system and conversation messages. Cache reads are reported in `usage.cachedContentTokens`, and cache writes in `usage.custom.cacheWriteInputTokens`.

```typescript
const response = await ai.generate({
  model: anthropicClaudeSonnet45V1('us'),
  system: [{ text: longInstructions, metadata: { cachePoint: true } }],
  prompt: 'Summarise the instructions.',
});
```

### Media input

Images, documents and videos are sent to Bedrock as the part's bytes, picked by the part's content type:

- images: `png`, `jpeg`, `gif`, `webp`
- documents: `pdf`, `csv`, `txt`, `html`, `md`, `doc`, `docx`, `xls`, `xlsx`
- videos (Nova models): `mp4`, `mov`, `mkv`, `webm`, `flv`, `mpeg`, `mpg`, `wmv`, `3gp`

Pass media as a base64 data URL, or as an `s3://` URI that your Bedrock role can read. Bedrock does not fetch `http(s)://` URLs, so the plugin rejects them; download the file and pass it as a data URL instead.

```typescript
const response = await ai.generate({
  model: amazonNovaLiteV1,
  prompt: [
    { text: 'What is in this picture?' },
    { media: { url: `data:image/jpeg;base64,${imageBase64}` } },
    { media: { url: 's3://my-bucket/report.pdf', contentType: 'application/pdf' } },
  ],
});
```

For more detailed examples and the explanation of other functionalities, refer to the [official Genkit documentation](https://genkit.dev/).

### Embeddings

Each document gets its own embedding, in the order you pass them. The plugin sends each model family its own request shape:

| Embedder | Input | Config |
|---|---|---|
| `amazonTitanEmbedTextV2`, `amazonTitanEmbedTextG1V1` | text | `dimensions` (v2: 256, 512, 1024), `normalize` (v2) |
| `amazonTitanEmbedMultimodalV2` | text, png/jpeg image, or both | `dimensions` (256, 384, 1024) |
| `cohereEmbedEnglishV3`, `cohereEmbedMultilingualV3`, `cohereEmbedV4` | text (batched, 96 per call) or image | `inputType`, `truncate`, `dimensions` (v4) |
| `amazonNova2MultimodalEmbeddingsV1` | text, image or video | `embeddingPurpose`, `dimensions` (256, 384, 1024 (default), 3072), `truncate` |

```typescript
const embeddings = await ai.embedMany({
  embedder: cohereEmbedV4,
  content: ['first document', 'second document'],
  options: { inputType: 'search_document', dimensions: 1024 },
});
```

Images are passed as base64 data URLs in a document's media. A document with no text or media is rejected.

### Reranking

Cohere Rerank 3.5 is registered as a Genkit reranker. Documents come back most relevant first, with the score in `metadata.score`. Set `k` to keep only the top documents:

```typescript
import { cohereRerank35 } from 'genkitx-aws-bedrock';

const ranked = await ai.rerank({
  reranker: cohereRerank35,
  query: 'What is the capital of France?',
  documents: [
    Document.fromText('Berlin is the capital of Germany.'),
    Document.fromText('Paris is the capital of France.'),
  ],
  options: { k: 1 },
});
```

Amazon Rerank 1.0 (`amazon.rerank-v1:0`) isn't supported. AWS documents it only for the `bedrock-agent-runtime` Rerank API, not for InvokeModel, and this plugin only calls `bedrock-runtime`; asking for it throws a clear error.

The `cohereRerank35V1` model reference is deprecated: rerank models can't be called through `generate()`, so it is no longer registered as a model.

### Image generation

Titan Image Generator v2, Nova Canvas, Stable Diffusion 3.5 Large, Stable Image Core and Stable Image Ultra are registered as image models. The prompt is the text of the latest user message, and each image comes back as a media part, `image/png` unless a Stable Diffusion 3.5 or Stable Image model is asked for another `output_format`:

```typescript
import { amazonNovaCanvasV1 } from 'genkitx-aws-bedrock';

const response = await ai.generate({
  model: amazonNovaCanvasV1,
  prompt: 'A watercolour of a lighthouse at dawn',
  config: { numberOfImages: 1, width: 1024, height: 1024, negativePrompt: 'people' },
});
const image = response.media; // { url: 'data:image/png;base64,...', contentType: 'image/png' }
```

Config fields a family doesn't take are ignored for it. For Titan and Nova Canvas, `imageGenerationConfig` is merged over the typed fields. Unknown fields are sent as-is to Stability models; set `output_format: 'jpeg'` or `'webp'` on Stable Diffusion 3.5 and Stable Image models and the media part is labelled `image/jpeg` or `image/webp`. Titan, Nova Canvas and Stable Diffusion XL always return PNG, and an `output_format` is ignored for them. Other image model IDs, including Stable Diffusion XL, can be added with `customModels` and are routed to the right request shape. Filtered output finishes with `finishReason: 'blocked'`.

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

When `streaming: true` is set, `onCallGenkit` returns a streaming Lambda handler directly for real incremental streaming via [Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html). This is compatible with `streamFlow` from `genkit/beta/client`.

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

// streaming: true returns a StreamifyHandler directly
export const streamingHandler = onCallGenkit(
  { streaming: true, cors: { origin: '*' } },
  myStreamingFlow
);
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

Streaming response (SSE, via `streaming: true`):
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
