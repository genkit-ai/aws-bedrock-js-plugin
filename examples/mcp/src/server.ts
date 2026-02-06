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

import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from 'express';


const server = new McpServer({
    name: 'demo-server',
    version: '1.0.0'
});

// Use the 'tool' method with zod schemas for input
// @ts-expect-error - Type instantiation is excessively deep and possibly infinite
server.tool(
    'add',
    'Add two numbers',
    {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
    },
    async ({ a, b }) => {
        console.log(`Processing a request for numbers ${a} and ${b}`);
        const output = { result: a + b };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }]
        };
    }
);


async function main() {
    const app = express();
    app.use(express.json());
    
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `session-${Date.now()}`,
    });
    
    app.post('/mcp', async (req: Request, res: Response) => {
        await transport.handleRequest(req, res, req.body);
    });
    
    await server.connect(transport);
    
    app.listen(3001, () => {
        console.log("MCP Server running on http://localhost:3001/mcp");
    });
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
