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
/* eslint-disable  @typescript-eslint/no-explicit-any */

import {
  Document,
  GenkitError,
  embedderRef as createEmbedderRef,
} from 'genkit';

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { z } from 'genkit';
import { embedder } from 'genkit/plugin';

import { toGenkitError } from './errors.js';

export const TextEmbeddingConfigSchema = z.object({
  dimensions: z
    .number()
    .optional()
    .describe(
      'Embedding size. Titan Text v2: 256, 512 or 1024. Titan Multimodal: 256, 384 or 1024. Cohere Embed v4: 256, 512, 1024 or 1536. Nova: 256, 384, 1024 or 3072.'
    ),
  inputType: z
    .enum(['search_document', 'search_query', 'classification', 'clustering'])
    .optional()
    .describe('Cohere only. Defaults to search_document.'),
  embeddingPurpose: z
    .enum([
      'GENERIC_INDEX',
      'GENERIC_RETRIEVAL',
      'TEXT_RETRIEVAL',
      'IMAGE_RETRIEVAL',
      'VIDEO_RETRIEVAL',
      'DOCUMENT_RETRIEVAL',
      'AUDIO_RETRIEVAL',
      'CLASSIFICATION',
      'CLUSTERING',
    ])
    .optional()
    .describe('Nova only. Defaults to GENERIC_INDEX.'),
  normalize: z.boolean().optional().describe('Titan Text v2 only.'),
  truncate: z
    .enum(['NONE', 'START', 'END'])
    .optional()
    .describe(
      'Cohere and Nova. How to cut text that is too long. Defaults to END.'
    ),
});

export type TextEmbeddingGeckoConfig = z.infer<
  typeof TextEmbeddingConfigSchema
>;
export type AwsBedrockEmbedderConfig = TextEmbeddingGeckoConfig;

export const TextEmbeddingInputSchema = z.string();

export const amazonNova2MultimodalEmbeddingsV1 = createEmbedderRef({
  name: 'aws-bedrock/amazon.nova-2-multimodal-embeddings-v1:0',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Amazon - nova-2-multimodal-embeddings-v1:0',
    supports: {
      input: ['text', 'image', 'video'],
      multilingual: true,
    },
  },
});

export const amazonTitanEmbedTextV2 = createEmbedderRef({
  name: 'aws-bedrock/amazon.titan-embed-text-v2:0',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Amazon - titan-embed-text-v2:0',
    supports: {
      input: ['text'],
    },
  },
});

export const amazonTitanEmbedMultimodalV2 = createEmbedderRef({
  name: 'aws-bedrock/amazon.titan-embed-image-v1',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Amazon - titan-embed-multimodal-v2:0',
    supports: {
      input: ['text', 'image'],
    },
  },
});

export const amazonTitanEmbedTextG1V1 = createEmbedderRef({
  name: 'aws-bedrock/amazon.titan-embed-text-v1',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1536,
    label: 'Amazon - titan-embed-text-v1',
    supports: {
      input: ['text'],
    },
  },
});

export const cohereEmbedV4 = createEmbedderRef({
  name: 'aws-bedrock/cohere.embed-v4:0',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Cohere - Embed v4',
    supports: {
      input: ['text', 'image'],
      multilingual: true,
    },
  },
});

export const cohereEmbedEnglishV3 = createEmbedderRef({
  name: 'aws-bedrock/cohere.embed-english-v3',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Cohere - embed-english-v3',
    supports: {
      input: ['text'],
    },
  },
});

export const cohereEmbedMultilingualV3 = createEmbedderRef({
  name: 'aws-bedrock/cohere.embed-multilingual-v3',
  configSchema: TextEmbeddingConfigSchema,
  info: {
    dimensions: 1024,
    label: 'Cohere - embed-multilingual-v3',
    supports: {
      input: ['text'],
    },
  },
});

export const SUPPORTED_EMBEDDING_MODELS: Record<string, any> = {
  'amazon.titan-embed-text-v2:0': amazonTitanEmbedTextV2,
  'amazon.titan-embed-image-v1': amazonTitanEmbedMultimodalV2,
  'amazon.titan-embed-text-v1': amazonTitanEmbedTextG1V1,
  'cohere.embed-english-v3': cohereEmbedEnglishV3,
  'cohere.embed-multilingual-v3': cohereEmbedMultilingualV3,
  'cohere.embed-v4:0': cohereEmbedV4,
  'amazon.nova-2-multimodal-embeddings-v1:0': amazonNova2MultimodalEmbeddingsV1,
};

/** The request shape an embedding model family takes. */
type EmbedderFamily = 'titan-text' | 'titan-multimodal' | 'cohere' | 'nova';

/**
 * Picks the request shape from the model ID, ignoring any cross-region
 * inference-profile prefix.
 */
export function embedderFamily(modelId: string): EmbedderFamily | undefined {
  const id = modelId.replace(/^(us|eu|apac|jp|au|ca|global|us-gov)\./, '');
  if (id.startsWith('amazon.titan-embed-image')) return 'titan-multimodal';
  if (id.startsWith('amazon.titan-embed')) return 'titan-text';
  if (id.startsWith('cohere.embed')) return 'cohere';
  if (id.startsWith('amazon.nova') && id.includes('embed')) return 'nova';
  return undefined;
}

/** Bedrock limits Cohere text batches to 96 texts. */
const COHERE_BATCH_SIZE = 96;
/** Requests in flight at once for families that embed one document per call. */
const CONCURRENCY = 8;

const IMAGE_FORMATS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const VIDEO_FORMATS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'video/x-flv': 'flv',
  'video/mpeg': 'mpeg',
  'video/mpg': 'mpg',
  'video/x-ms-wmv': 'wmv',
  'video/3gpp': '3gp',
};

/** A document's media, decoded from its data URL. */
interface DocMedia {
  contentType: string;
  base64: string;
  dataUrl: string;
}

function invalid(message: string): GenkitError {
  return new GenkitError({ status: 'INVALID_ARGUMENT', message });
}

function docMedia(doc: Document, index: number): DocMedia | undefined {
  const media = doc.media[0];
  if (!media) return undefined;
  const match = media.url.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]*)$/);
  if (!match) {
    throw invalid(
      `Document ${index}: embedding media must be a base64 data URL.`
    );
  }
  const contentType = (media.contentType || match[1] || '').toLowerCase();
  if (!contentType) {
    throw invalid(`Document ${index}: media has no content type.`);
  }
  return {
    contentType,
    base64: match[2],
    dataUrl: `data:${contentType};base64,${match[2]}`,
  };
}

/** Runs `fn` over `items` with at most CONCURRENCY calls in flight. */
async function mapLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker)
  );
  return out;
}

async function invoke(
  client: BedrockRuntimeClient,
  modelId: string,
  payload: Record<string, unknown>
): Promise<any> {
  const input: InvokeModelCommandInput = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  };
  try {
    const response = (await client.send(
      new InvokeModelCommand(input)
    )) as InvokeModelCommandOutput;
    return JSON.parse(new TextDecoder().decode(response.body));
  } catch (err) {
    throw toGenkitError(err);
  }
}

function vector(value: unknown, what: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new GenkitError({
      status: 'INTERNAL',
      message: `AWS Bedrock returned no embedding for ${what}.`,
    });
  }
  return value as number[];
}

async function embedTitanText(
  client: BedrockRuntimeClient,
  modelId: string,
  docs: Document[],
  options: AwsBedrockEmbedderConfig
): Promise<number[][]> {
  docs.forEach((doc, i) => {
    if (doc.media.length > 0) {
      throw invalid(`Document ${i}: ${modelId} only embeds text.`);
    }
  });
  return mapLimit(docs, async (doc, i) => {
    const res = await invoke(client, modelId, {
      inputText: doc.text,
      dimensions: options.dimensions,
      normalize: options.normalize,
    });
    return vector(res.embedding, `document ${i}`);
  });
}

async function embedTitanMultimodal(
  client: BedrockRuntimeClient,
  modelId: string,
  docs: Document[],
  options: AwsBedrockEmbedderConfig
): Promise<number[][]> {
  return mapLimit(docs, async (doc, i) => {
    const media = docMedia(doc, i);
    if (
      media &&
      !['image/png', 'image/jpeg', 'image/jpg'].includes(media.contentType)
    ) {
      throw invalid(
        `Document ${i}: ${modelId} embeds png or jpeg images, not ${media.contentType}.`
      );
    }
    const res = await invoke(client, modelId, {
      inputText: doc.text || undefined,
      inputImage: media?.base64,
      embeddingConfig: options.dimensions
        ? { outputEmbeddingLength: options.dimensions }
        : undefined,
    });
    return vector(res.embedding, `document ${i}`);
  });
}

/** Cohere returns a bare array, or { float: [...] } when types are requested. */
function cohereVectors(res: any): number[][] {
  const embeddings = res.embeddings;
  return Array.isArray(embeddings) ? embeddings : (embeddings?.float ?? []);
}

async function embedCohere(
  client: BedrockRuntimeClient,
  modelId: string,
  docs: Document[],
  options: AwsBedrockEmbedderConfig
): Promise<number[][]> {
  const common = {
    embedding_types: ['float'],
    output_dimension: options.dimensions,
  };
  const out: number[][] = new Array(docs.length);

  // Cohere embeds one modality per document; text wins when a document has both.
  const texts: number[] = [];
  const images: { index: number; media: DocMedia }[] = [];
  docs.forEach((doc, i) => {
    if (doc.text) {
      texts.push(i);
      return;
    }
    const media = docMedia(doc, i);
    if (!media || !IMAGE_FORMATS[media.contentType]) {
      throw invalid(`Document ${i}: ${modelId} embeds text or images.`);
    }
    images.push({ index: i, media });
  });

  for (let start = 0; start < texts.length; start += COHERE_BATCH_SIZE) {
    const batch = texts.slice(start, start + COHERE_BATCH_SIZE);
    const res = await invoke(client, modelId, {
      ...common,
      texts: batch.map((i) => docs[i].text),
      input_type: options.inputType ?? 'search_document',
      truncate: options.truncate ?? 'END',
    });
    const vectors = cohereVectors(res);
    if (vectors.length !== batch.length) {
      throw new GenkitError({
        status: 'INTERNAL',
        message: `AWS Bedrock returned ${vectors.length} Cohere embeddings for ${batch.length} texts.`,
      });
    }
    batch.forEach((docIndex, j) => (out[docIndex] = vectors[j]));
  }

  // Bedrock takes one image per Cohere request.
  await mapLimit(images, async ({ index, media }) => {
    const res = await invoke(client, modelId, {
      ...common,
      images: [media.dataUrl],
      input_type: 'image',
    });
    out[index] = vector(cohereVectors(res)[0], `document ${index}`);
  });
  return out;
}

async function embedNova(
  client: BedrockRuntimeClient,
  modelId: string,
  docs: Document[],
  options: AwsBedrockEmbedderConfig
): Promise<number[][]> {
  return mapLimit(docs, async (doc, i) => {
    const params: Record<string, unknown> = {
      embeddingPurpose: options.embeddingPurpose ?? 'GENERIC_INDEX',
      embeddingDimension: options.dimensions,
    };
    const media = docMedia(doc, i);
    if (doc.text) {
      params.text = {
        truncationMode: options.truncate ?? 'END',
        value: doc.text,
      };
    } else if (media && IMAGE_FORMATS[media.contentType]) {
      params.image = {
        format: IMAGE_FORMATS[media.contentType],
        source: { bytes: media.base64 },
      };
    } else if (media && VIDEO_FORMATS[media.contentType]) {
      params.video = {
        format: VIDEO_FORMATS[media.contentType],
        source: { bytes: media.base64 },
        embeddingMode: 'AUDIO_VIDEO_COMBINED',
      };
    } else {
      throw invalid(
        `Document ${i}: ${modelId} embeds text, images or videos${media ? `, not ${media.contentType}` : ''}.`
      );
    }
    const res = await invoke(client, modelId, {
      taskType: 'SINGLE_EMBEDDING',
      singleEmbeddingParams: params,
    });
    return vector(res.embeddings?.[0]?.embedding, `document ${i}`);
  });
}

const EMBED_BY_FAMILY = {
  'titan-text': embedTitanText,
  'titan-multimodal': embedTitanMultimodal,
  cohere: embedCohere,
  nova: embedNova,
};

/**
 * Defines a Bedrock embedder. Each input document gets its own embedding,
 * in input order, using the request shape of the model's family (Titan Text,
 * Titan Multimodal, Cohere or Nova). Documents with no text or media are
 * rejected.
 */
export function awsBedrockEmbedder(name: string, client: BedrockRuntimeClient) {
  const modelRef = SUPPORTED_EMBEDDING_MODELS[name];
  if (!modelRef) throw new Error(`Unsupported model: ${name}`);
  const family = embedderFamily(name);
  if (!family) throw new Error(`Unsupported model: ${name}`);

  return embedder(
    {
      info: modelRef.info!,
      configSchema: TextEmbeddingConfigSchema,
      name: modelRef.name,
    },
    async (request) => {
      const docs = request.input.map((d) => new Document(d));
      docs.forEach((doc, i) => {
        if (!doc.text && doc.media.length === 0) {
          throw invalid(`Document ${i} has no text or media to embed.`);
        }
      });
      const vectors = await EMBED_BY_FAMILY[family](
        client,
        name,
        docs,
        request.options ?? {}
      );
      return { embeddings: vectors.map((embedding) => ({ embedding })) };
    }
  );
}
