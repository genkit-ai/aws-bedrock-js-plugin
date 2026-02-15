/* eslint-disable @typescript-eslint/no-explicit-any */
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
  amazonNovaLiteV1,
}from 'genkitx-bedrock';


dotenv.config();

const ai = genkit({
  plugins: [
    awsBedrock({
      customModels: ['openai.gpt-oss-20b-1:0'], // Register custom models here
      region: 'us-east-1',
    }),
  ],
  model: anthropicClaude35SonnetV2('us'),
});

/**
 * Alternative example using MCP client (requires MCP server setup)
 * 
 * Uncomment and adapt this code if you have an MCP server running:
 */
import { createMcpClient } from '@genkit-ai/mcp';

// Connect to MCP server
const mcpClient = createMcpClient({
  name: 'demo-server',
  mcpServer: {
    url: 'http://localhost:3001/mcp',
  },
});

console.log(`trying to connect to MCP server...`);

let tools: any[] = [];

(async () => {
  await mcpClient.ready();

  // Get tools from MCP server (these will have inputJsonSchema)
  tools = await mcpClient.getActiveTools(ai);

  console.log(`Retrieved ${tools.length} tools from MCP server.`);
})();

export const mcpServerToolFlow = ai.defineFlow(
  {
    name: 'mcpServerToolFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (question) => {
    
    // Use with AWS Bedrock via generateStream
    const { stream, response } = ai.generateStream({
      model: amazonNovaLiteV1,
      system: `You are a helpful AI assistant.
      You can use any of the tools provided to you to answer the question.
      IMPORTANT: After using a tool, you MUST provide a complete answer to the user's question.`,
      prompt: question,
      tools: tools,
    });
    
    for await (const chunk of stream) {
      console.log('Received chunk:', chunk.text);
    }
    
    return (await response).text;
  }
);

export const mcpServerToolFlowGenerate = ai.defineFlow(
  {
    name: 'mcpServerToolFlowGenerate',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (question) => {
    
    // Use with AWS Bedrock via generateStream
    const response = ai.generate({
      model: amazonNovaLiteV1,
      system: `You are a helpful AI assistant.
      You can use any of the tools provided to you to answer the question.
      IMPORTANT: After using a tool, you MUST provide a complete answer to the user's question.`,
      prompt: question,
      tools: tools,
    });
    
    return (await response).text;
  }
);


// Start Flow server (port 3400 by default)
startFlowServer({
  flows: [mcpServerToolFlow],
});
