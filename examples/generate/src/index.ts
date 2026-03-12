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

import { startFlowServer } from '@genkit-ai/express';
import dotenv from 'dotenv';
import { genkit, z } from 'genkit';
import { 
  anthropicClaude35SonnetV2, 
  awsBedrock,
  amazonTitanEmbedTextV2 
} from 'genkitx-bedrock';


dotenv.config();

const ai = genkit({
  plugins: [
    awsBedrock({
      // Register custom models here
      customModels: [
        'openai.gpt-oss-20b-1:0', 
        'arn:aws:bedrock:us-east-1:682227818354:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0'],
    }),
  ],
  model: anthropicClaude35SonnetV2('us'),
});

export const jokeFlow = ai.defineFlow(
  {
    name: 'jokeFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
   const llmResponse = await ai.generate({
      prompt: `Tell me a joke about ${subject}`,
    });
    return llmResponse.text;
  }
);

export const customModelFlow = ai.defineFlow(
  {
    name: 'customModelFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const llmResponse = await ai.generate({
      model: 'aws-bedrock/openai.gpt-oss-20b-1:0',
      prompt: `Tell me a joke about ${subject}`,
    });
    return llmResponse.text;
  }
);

export const streamingFlow = ai.defineFlow(
  {
    name: 'streamingFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const { response, stream } = ai.generateStream({
      prompt: `Write a short story about ${subject}`,
    });

    console.log('Streaming response:');

    for await (const chunk of stream) {
      console.log('Received chunk:', chunk.text);
    }

    return (await response).text;
  }
);

export const embedderFlow = ai.defineFlow(
  {
    name: 'embedderFlow',
    inputSchema: z.object({
      text: z.string(),
    }),
    outputSchema: z.object({
      embedding: z.array(z.number()),
      dimensions: z.number(),
    }),
  },
  async (input) => {
    const result = await ai.embed({
      embedder: amazonTitanEmbedTextV2,
      content: input.text,
    });
    
    return {
      embedding: result[0].embedding,
      dimensions: result[0].embedding.length,
    };
  }
);

/**
 * Structured output flow - a specialized flow for generating structured output from a Bedrock model.
 * 
 * Example usage:
 * ```
 * curl -X POST http://localhost:3400/structuredOutputFlow \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "data": "What is your name and age?"
 *   }'
 * ```
 * 
 * Example response:
 * ```
 * {
 *   "name": "Claude",
 *   "age": 2
 * }
 * ```
 */
export const structuredOutputFlow = ai.defineFlow(
  {
    name: 'structuredOutputFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (input) => {
    const result = await ai.generate({
      prompt: input,
      model: 'aws-bedrock/arn:aws:bedrock:us-east-1:682227818354:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      output: {
        format: 'json',
        schema: z.object({
          name: z.string(),
          age: z.number(),
        })
      }
    });

    console.log('Result', result);
    return result.text;
  }
);

/**
 * Document analysis flow - demonstrates how to send documents (PDF, CSV, etc.)
 * to Bedrock models for analysis.
 * 
 * Supported document types:
 * - PDF (application/pdf)
 * - CSV (text/csv)
 * - TXT (text/plain)
 * - HTML (text/html)
 * - Markdown (text/markdown)
 * - DOC (application/msword)
 * - DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 * - XLS (application/vnd.ms-excel)
 * - XLSX (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 * 
 * Example usage:
 * ```
 * curl -X POST http://localhost:3400/documentAnalysisFlow \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "data": {
 *       "documentBase64": "BASE64_ENCODED_DOCUMENT_CONTENT",
 *       "mimeType": "application/pdf",
 *       "question": "What is this document about?"
 *     }
 *   }'
 * ```
 */
export const documentAnalysisFlow = ai.defineFlow(
  {
    name: 'documentAnalysisFlow',
    inputSchema: z.object({
      documentBase64: z.string().describe('Base64 encoded document content'),
      mimeType: z.string().describe('MIME type of the document (e.g., application/pdf, text/csv)'),
      question: z.string().describe('Question to ask about the document'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    const dataUrl = `data:${input.mimeType};base64,${input.documentBase64}`;
    
    const llmResponse = await ai.generate({
      prompt: [
        {
          media: {
            contentType: input.mimeType,
            url: dataUrl,
          },
        },
        {
          text: input.question,
        },
      ],
    });
    
    return llmResponse.text;
  }
);

/**
 * CSV analysis flow - a specialized flow for analyzing CSV data.
 * 
 * Example usage:
 * ```
 * curl -X POST http://localhost:3400/csvAnalysisFlow \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "data": {
 *       "csvContent": "name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago",
 *       "question": "What is the average age?"
 *     }
 *   }'
 * ```
 */
export const csvAnalysisFlow = ai.defineFlow(
  {
    name: 'csvAnalysisFlow',
    inputSchema: z.object({
      csvContent: z.string().describe('CSV content as a string'),
      question: z.string().describe('Question to ask about the CSV data'),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    // Convert CSV string to base64
    const csvBase64 = Buffer.from(input.csvContent).toString('base64');
    const dataUrl = `data:text/csv;base64,${csvBase64}`;
    
    const llmResponse = await ai.generate({
      prompt: [
        {
          media: {
            contentType: 'text/csv',
            url: dataUrl,
          },
        },
        {
          text: input.question,
        },
      ],
    });
    
    return llmResponse.text;
  }
);

startFlowServer({
  flows: [jokeFlow, customModelFlow, streamingFlow, embedderFlow, documentAnalysisFlow, csvAnalysisFlow, structuredOutputFlow],
});
