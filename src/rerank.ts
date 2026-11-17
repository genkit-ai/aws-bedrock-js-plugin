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

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { Document, GenkitError, rerankerRef, z } from 'genkit';
import { reranker } from 'genkit/plugin';

import { toGenkitError } from './errors.js';

/**
 * Options for Bedrock rerankers.
 */
export const RerankConfigSchema = z.object({
  k: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('How many of the top documents to return. Defaults to all.'),
});

export type RerankConfig = z.infer<typeof RerankConfigSchema>;

export const cohereRerank35 = rerankerRef({
  name: 'aws-bedrock/cohere.rerank-v3-5:0',
  configSchema: RerankConfigSchema,
  info: { label: 'Cohere - Rerank 3.5' },
});

export const amazonRerankV1 = rerankerRef({
  name: 'aws-bedrock/amazon.rerank-v1:0',
  configSchema: RerankConfigSchema,
  info: { label: 'Amazon - Rerank 1.0' },
});

/** The rerankers the plugin registers, by Bedrock model ID. */
export const SUPPORTED_RERANKERS = {
  'cohere.rerank-v3-5:0': cohereRerank35,
  'amazon.rerank-v1:0': amazonRerankV1,
};

/** Cohere Rerank on Bedrock needs api_version 2. */
const COHERE_RERANK_API_VERSION = 2;

interface RerankResult {
  index: number;
  relevance_score: number;
}

/**
 * Builds the InvokeModel body for a rerank model.
 */
export function toRerankRequest(
  modelId: string,
  query: string,
  documents: string[],
  options: RerankConfig
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    query,
    documents,
    top_n: Math.min(options.k ?? documents.length, documents.length),
  };
  if (modelId.includes('cohere.rerank')) {
    body.api_version = COHERE_RERANK_API_VERSION;
  }
  return body;
}

/**
 * Defines a Bedrock reranker. Documents come back ordered by relevance, with
 * the score in `metadata.score` alongside their original metadata.
 */
export function awsBedrockReranker(
  name: keyof typeof SUPPORTED_RERANKERS | string,
  client: BedrockRuntimeClient
) {
  const ref =
    SUPPORTED_RERANKERS[name as keyof typeof SUPPORTED_RERANKERS] ??
    rerankerRef({
      name: `aws-bedrock/${name}`,
      configSchema: RerankConfigSchema,
      info: { label: `AWS Bedrock - ${name}` },
    });

  return reranker(
    { name: ref.name, configSchema: RerankConfigSchema, info: ref.info },
    async (query: Document, documents: Document[], options) => {
      if (documents.length === 0) return { documents: [] };
      if (!query.text) {
        throw new GenkitError({
          status: 'INVALID_ARGUMENT',
          message: 'The rerank query has no text.',
        });
      }
      const texts = documents.map((doc, i) => {
        if (!doc.text) {
          throw new GenkitError({
            status: 'INVALID_ARGUMENT',
            message: `Document ${i} has no text to rerank.`,
          });
        }
        return doc.text;
      });

      let results: RerankResult[];
      try {
        const response = (await client.send(
          new InvokeModelCommand({
            modelId: name,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(
              toRerankRequest(name, query.text, texts, options ?? {})
            ),
          })
        )) as InvokeModelCommandOutput;
        results =
          JSON.parse(new TextDecoder().decode(response.body)).results ?? [];
      } catch (err) {
        throw toGenkitError(err);
      }

      return {
        documents: results
          .filter((r) => documents[r.index])
          .sort((a, b) => b.relevance_score - a.relevance_score)
          .map((r) => {
            const doc = documents[r.index];
            return {
              content: doc.content,
              metadata: { ...doc.metadata, score: r.relevance_score },
            };
          }),
      };
    }
  );
}
