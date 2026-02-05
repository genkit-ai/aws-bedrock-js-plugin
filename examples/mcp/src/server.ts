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
