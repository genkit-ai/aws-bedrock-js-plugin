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

import { GenerationCommonConfigSchema, z } from 'genkit';

/**
 * Prompt-cache point placed after a part: `true` or `"default"` for a
 * default cache point, or an object to set its TTL.
 */
export const CachePointSchema = z.union([
  z.literal(true),
  z.literal('default'),
  z.object({
    type: z.literal('default').optional(),
    ttl: z.enum(['5m', '1h']).optional(),
  }),
]);

/**
 * Per-call configuration for AWS Bedrock models: Genkit's common config plus
 * the Converse API's own request fields.
 */
export const AwsBedrockConfigSchema = GenerationCommonConfigSchema.extend({
  additionalModelRequestFields: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      "Model-specific request fields, sent as Converse additionalModelRequestFields. For example { thinking: { type: 'enabled', budget_tokens: 2048 } } for Claude, or { inferenceConfig: { topK: 20 } } for Nova."
    ),
  additionalModelResponseFieldPaths: z
    .array(z.string())
    .optional()
    .describe(
      "JSON pointers to model-specific response fields to return, such as '/stop_sequence'."
    ),
  guardrailConfig: z
    .object({
      guardrailIdentifier: z.string(),
      guardrailVersion: z.string(),
      trace: z.enum(['enabled', 'disabled', 'enabled_full']).optional(),
      streamProcessingMode: z
        .enum(['sync', 'async'])
        .optional()
        .describe('Only used when streaming.'),
    })
    .optional()
    .describe('A Bedrock guardrail to apply to the request.'),
  performanceConfig: z
    .object({ latency: z.enum(['standard', 'optimized']) })
    .optional()
    .describe("Use 'optimized' for latency-optimized inference."),
  serviceTier: z
    .enum(['default', 'priority', 'flex', 'reserved'])
    .optional()
    .describe('The Bedrock service tier to process the request with.'),
  requestMetadata: z
    .record(z.string(), z.string())
    .optional()
    .describe('Key-value pairs logged with the request for filtering.'),
});

export type AwsBedrockConfig = z.infer<typeof AwsBedrockConfigSchema>;
