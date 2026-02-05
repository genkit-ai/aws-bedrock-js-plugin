/**
 * Copyright 2026 Xavier Portilla Edo
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

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
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

/**
 * CORS configuration options
 */
export interface CorsOptions {
  /**
   * Allowed origins for CORS requests.
   * Can be a string, array of strings, or '*' for all origins.
   * @default '*'
   */
  origin?: string | string[];

  /**
   * Allowed HTTP methods.
   * @default ['POST', 'OPTIONS']
   */
  methods?: string[];

  /**
   * Allowed headers in requests.
   * @default ['Content-Type', 'Authorization']
   */
  allowedHeaders?: string[];

  /**
   * Headers exposed to the client.
   */
  exposedHeaders?: string[];

  /**
   * Whether to allow credentials.
   * @default false
   */
  credentials?: boolean;

  /**
   * Max age for preflight cache (in seconds).
   * @default 86400 (24 hours)
   */
  maxAge?: number;
}

/**
 * Options for configuring the Lambda handler
 */
export interface LambdaOptions<T = unknown> {
  /**
   * CORS configuration. Set to false to disable CORS headers.
   * @default { origin: '*', methods: ['POST', 'OPTIONS'] }
   */
  cors?: CorsOptions | boolean;

  /**
   * Custom authorization function that runs before the flow is executed.
   * Return true to allow the request, false to deny.
   * Can also throw an error with a custom message.
   */
  authPolicy?: (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context,
    data: T,
  ) => boolean | Promise<boolean>;

  /**
   * Whether to enable streaming responses using Lambda response streaming.
   * Note: This requires Lambda function URL with response streaming enabled.
   * @default false
   */
  enableStreaming?: boolean;

  /**
   * Custom error handler for transforming errors before response.
   */
  onError?: (error: Error) =>
    | { statusCode: number; message: string }
    | Promise<{
        statusCode: number;
        message: string;
      }>;

  /**
   * Additional context to pass to the Genkit flow.
   */
  flowContext?: Record<string, unknown>;

  /**
   * Whether to log incoming events (for debugging).
   * @default false
   */
  debug?: boolean;
}

/**
 * Response wrapper for successful flow execution
 */
export interface FlowResponse<T> {
  success: true;
  data: T;
  flowName: string;
}

/**
 * Response wrapper for failed flow execution
 */
export interface FlowErrorResponse {
  success: false;
  error: string;
  code?: string;
  flowName?: string;
}

/**
 * Union type for flow responses
 */
export type LambdaFlowResponse<T> = FlowResponse<T> | FlowErrorResponse;

/**
 * Lambda handler function type for API Gateway v1
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

/**
 * Lambda handler function type for API Gateway v2
 */
export type LambdaHandlerV2 = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

/**
 * Run options for flow execution
 */
export interface FlowRunOptions {
  context?: Record<string, unknown>;
}

/**
 * Callable function type that includes the raw handler and metadata
 */
export interface CallableLambdaFunction<F extends Flow> extends LambdaHandler {
  /**
   * The underlying Genkit flow
   */
  flow: F;

  /**
   * Execute the flow directly (for testing)
   */
  run: (
    input: FlowInput<F>,
    options?: FlowRunOptions,
  ) => Promise<FlowOutput<F>>;

  /**
   * Stream the flow directly (for testing)
   */
  stream: (
    input: FlowInput<F>,
    options?: FlowRunOptions,
  ) => {
    stream: AsyncIterable<FlowStream<F>>;
    output: Promise<FlowOutput<F>>;
  };

  /**
   * Flow name
   */
  flowName: string;
}

/**
 * Builds CORS headers based on options
 */
function buildCorsHeaders(
  corsOptions: CorsOptions | boolean | undefined,
  requestOrigin?: string,
): Record<string, string> {
  if (corsOptions === false) {
    return {};
  }

  const opts: CorsOptions =
    corsOptions === true || corsOptions === undefined ? {} : corsOptions;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Handle origin
  const origin = opts.origin ?? "*";
  if (Array.isArray(origin)) {
    // Check if request origin is in allowed list
    if (requestOrigin && origin.includes(requestOrigin)) {
      headers["Access-Control-Allow-Origin"] = requestOrigin;
    } else if (origin.length > 0) {
      headers["Access-Control-Allow-Origin"] = origin[0];
    }
  } else {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  // Handle methods
  const methods = opts.methods ?? ["POST", "OPTIONS"];
  headers["Access-Control-Allow-Methods"] = methods.join(", ");

  // Handle allowed headers
  const allowedHeaders = opts.allowedHeaders ?? [
    "Content-Type",
    "Authorization",
  ];
  headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ");

  // Handle exposed headers
  if (opts.exposedHeaders && opts.exposedHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = opts.exposedHeaders.join(", ");
  }

  // Handle credentials
  if (opts.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  // Handle max age
  const maxAge = opts.maxAge ?? 86400;
  headers["Access-Control-Max-Age"] = String(maxAge);

  return headers;
}

/**
 * Parses the request body from an API Gateway event
 */
function parseRequestBody<T>(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): T {
  if (!event.body) {
    return {} as T;
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Invalid JSON in request body");
  }
}

/**
 * Gets the request origin from headers
 */
function getRequestOrigin(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): string | undefined {
  const headers = event.headers || {};
  return headers["origin"] || headers["Origin"];
}

/**
 * Creates a Lambda handler for a Genkit flow.
 *
 * This function wraps a Genkit flow to create an AWS Lambda handler that:
 * - Handles CORS automatically
 * - Supports custom authorization policies
 * - Provides proper error handling
 * - Returns standardized response format
 *
 * @example Basic usage
 * ```typescript
 * import { genkit, z } from 'genkit';
 * import { onCallGenkit } from 'genkitx-aws-bedrock';
 * import { awsBedrock, amazonNovaProV1 } from 'genkitx-aws-bedrock';
 *
 * const ai = genkit({
 *   plugins: [awsBedrock()],
 *   model: amazonNovaProV1(),
 * });
 *
 * const myFlow = ai.defineFlow(
 *   { name: 'myFlow', inputSchema: z.string(), outputSchema: z.string() },
 *   async (input) => {
 *     const { text } = await ai.generate({ prompt: input });
 *     return text;
 *   }
 * );
 *
 * export const handler = onCallGenkit(myFlow);
 * ```
 *
 * @example With options
 * ```typescript
 * export const handler = onCallGenkit(
 *   {
 *     cors: { origin: 'https://myapp.com', credentials: true },
 *     authPolicy: async (event, context, data) => {
 *       const token = event.headers['Authorization'];
 *       return validateToken(token);
 *     },
 *     debug: true,
 *   },
 *   myFlow
 * );
 * ```
 *
 * @param action - The Genkit flow to wrap
 * @returns A Lambda handler function
 */
export function onCallGenkit<F extends Flow>(
  flow: F,
): CallableLambdaFunction<F>;

/**
 * Creates a Lambda handler for a Genkit flow with options.
 *
 * @param opts - Configuration options for the Lambda handler
 * @param flow - The Genkit flow to wrap
 * @returns A Lambda handler function
 */
export function onCallGenkit<F extends Flow>(
  opts: LambdaOptions<FlowInput<F>>,
  flow: F,
): CallableLambdaFunction<F>;

/**
 * Implementation of onCallGenkit
 */
export function onCallGenkit<F extends Flow>(
  optsOrFlow: F | LambdaOptions<FlowInput<F>>,
  flowArg?: F,
): CallableLambdaFunction<F> {
  let opts: LambdaOptions<FlowInput<F>>;
  let flow: F;

  if (arguments.length === 1) {
    opts = {};
    flow = optsOrFlow as F;
  } else {
    opts = optsOrFlow as LambdaOptions<FlowInput<F>>;
    flow = flowArg as F;
  }

  const flowName = flow.__action?.name || "unknown";

  const handler: LambdaHandler = async (
    event: APIGatewayProxyEvent,
    context: Context,
  ): Promise<APIGatewayProxyResult> => {
    const requestOrigin = getRequestOrigin(event);
    const corsHeaders = buildCorsHeaders(opts.cors, requestOrigin);

    // Handle OPTIONS preflight request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: "",
      };
    }

    // Debug logging
    if (opts.debug) {
      console.log(`[${flowName}] Event:`, JSON.stringify(event, null, 2));
      console.log(`[${flowName}] Context:`, JSON.stringify(context, null, 2));
    }

    try {
      // Parse request body
      const data = parseRequestBody<FlowInput<F>>(event);

      // Run authorization policy if provided
      if (opts.authPolicy) {
        const authorized = await opts.authPolicy(event, context, data);
        if (!authorized) {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({
              success: false,
              error: "Unauthorized",
              code: "UNAUTHORIZED",
              flowName,
            } satisfies FlowErrorResponse),
          };
        }
      }

      // Build flow context
      const flowContext: Record<string, unknown> = {
        ...(opts.flowContext || {}),
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

      if (opts.debug) {
        console.log(`[${flowName}] Running flow with input:`, data);
      }

      // Execute the flow
      const { result } = await flow.run(data, { context: flowContext });

      if (opts.debug) {
        console.log(`[${flowName}] Flow completed successfully`);
      }

      // Return success response
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          data: result as FlowOutput<F>,
          flowName,
        } satisfies FlowResponse<FlowOutput<F>>),
      };
    } catch (error) {
      console.error(`[${flowName}] Error:`, error);

      // Use custom error handler if provided
      if (opts.onError) {
        const customError = await opts.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
        return {
          statusCode: customError.statusCode,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: customError.message,
            flowName,
          } satisfies FlowErrorResponse),
        };
      }

      // Default error response
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const statusCode = isAuthError(error) ? 401 : 500;

      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          flowName,
        } satisfies FlowErrorResponse),
      };
    }
  };

  // Attach additional properties to the handler
  const callableFunction = handler as CallableLambdaFunction<F>;
  callableFunction.flow = flow;
  callableFunction.flowName = flowName;

  callableFunction.run = async (
    input: FlowInput<F>,
    runOptions?: FlowRunOptions,
  ): Promise<FlowOutput<F>> => {
    const { result } = await flow.run(input, runOptions || { context: {} });
    return result as FlowOutput<F>;
  };

  callableFunction.stream = (
    input: FlowInput<F>,
    streamOptions?: FlowRunOptions,
  ) => {
    const { stream, output } = flow.stream(
      input,
      streamOptions || { context: {} },
    );
    return {
      stream: stream as AsyncIterable<FlowStream<F>>,
      output: output as Promise<FlowOutput<F>>,
    };
  };

  return callableFunction;
}

/**
 * Helper to check if an error is an authorization error
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("authentication")
    );
  }
  return false;
}

/**
 * Creates a simple authorization policy that always allows requests.
 * Useful for public endpoints.
 */
export const allowAll = () => (): boolean => true;

/**
 * Creates an authorization policy that requires a specific header.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   { authPolicy: requireHeader('X-API-Key', 'my-secret-key') },
 *   myFlow
 * );
 * ```
 */
export const requireHeader =
  (headerName: string, expectedValue?: string) =>
  (event: APIGatewayProxyEvent | APIGatewayProxyEventV2): boolean => {
    const headers = event.headers || {};
    const value =
      headers[headerName] ||
      headers[headerName.toLowerCase()] ||
      headers[headerName.toUpperCase()];

    if (!value) {
      return false;
    }

    if (expectedValue !== undefined) {
      return value === expectedValue;
    }

    return true;
  };

/**
 * Creates an authorization policy that requires Bearer token authentication.
 * You provide a validation function that receives the token.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   {
 *     authPolicy: requireBearerToken(async (token) => {
 *       return await validateJWT(token);
 *     })
 *   },
 *   myFlow
 * );
 * ```
 */
export const requireBearerToken =
  (validateToken: (token: string) => boolean | Promise<boolean>) =>
  async (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  ): Promise<boolean> => {
    const headers = event.headers || {};
    const authHeader =
      headers["Authorization"] ||
      headers["authorization"] ||
      headers["AUTHORIZATION"];

    if (!authHeader) {
      return false;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return false;
    }

    const token = match[1];
    return validateToken(token);
  };

/**
 * Creates an authorization policy that requires an API key in a header.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   { authPolicy: requireApiKey('X-API-Key', process.env.API_KEY!) },
 *   myFlow
 * );
 * ```
 */
export const requireApiKey =
  (headerName: string, apiKey: string) =>
  (event: APIGatewayProxyEvent | APIGatewayProxyEventV2): boolean => {
    return requireHeader(headerName, apiKey)(event);
  };

/**
 * Combines multiple authorization policies with AND logic.
 * All policies must pass for the request to be authorized.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   {
 *     authPolicy: allOf(
 *       requireHeader('X-API-Key', 'secret'),
 *       requireBearerToken(validateToken)
 *     )
 *   },
 *   myFlow
 * );
 * ```
 */
export const allOf =
  <T>(
    ...policies: Array<
      (
        event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
        context: Context,
        data: T,
      ) => boolean | Promise<boolean>
    >
  ) =>
  async (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context,
    data: T,
  ): Promise<boolean> => {
    for (const policy of policies) {
      const result = await policy(event, context, data);
      if (!result) {
        return false;
      }
    }
    return true;
  };

/**
 * Combines multiple authorization policies with OR logic.
 * At least one policy must pass for the request to be authorized.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   {
 *     authPolicy: anyOf(
 *       requireApiKey('X-API-Key', 'secret'),
 *       requireBearerToken(validateToken)
 *     )
 *   },
 *   myFlow
 * );
 * ```
 */
export const anyOf =
  <T>(
    ...policies: Array<
      (
        event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
        context: Context,
        data: T,
      ) => boolean | Promise<boolean>
    >
  ) =>
  async (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context,
    data: T,
  ): Promise<boolean> => {
    for (const policy of policies) {
      const result = await policy(event, context, data);
      if (result) {
        return true;
      }
    }
    return false;
  };

export default onCallGenkit;
