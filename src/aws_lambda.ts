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

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context as LambdaContext,
  StreamifyHandler,
} from "aws-lambda";
import { type Flow, type z, type ActionContext, UserFacingError } from "genkit";
import {
  getCallableJSON,
  getHttpStatus,
  type ContextProvider,
  type RequestData,
} from "genkit/context";

// Re-export genkit context types for convenience
export type { ContextProvider, RequestData, ActionContext };

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
 * Extended action context that includes Lambda-specific information
 */
export interface LambdaActionContext extends ActionContext {
  /** Lambda-specific context data */
  lambda?: {
    event: {
      requestContext: Record<string, unknown>;
      headers: Record<string, string | undefined>;
      queryStringParameters: Record<string, string | undefined> | null;
      pathParameters: Record<string, string | undefined> | null;
    };
    context: {
      functionName: string;
      functionVersion: string;
      invokedFunctionArn: string;
      memoryLimitInMB: string;
      awsRequestId: string;
    };
  };
}

/**
 * Options for configuring the Lambda handler
 */
export interface LambdaOptions<
  C extends ActionContext = ActionContext,
  T = unknown,
> {
  /**
   * CORS configuration. Set to false to disable CORS headers.
   * @default { origin: '*', methods: ['POST', 'OPTIONS'] }
   */
  cors?: CorsOptions | boolean;

  /**
   * Context provider that parses request data and returns context for the flow.
   * This follows the same pattern as express, next.js, and other Genkit integrations.
   *
   * The context provider receives a RequestData object containing:
   * - method: HTTP method ('GET', 'POST', etc.)
   * - headers: Lowercase headers from the request
   * - input: Parsed request body
   *
   * Return an ActionContext object that will be available via getContext() in the flow.
   * Throw UserFacingError for authentication/authorization failures.
   *
   * @example
   * ```typescript
   * import { UserFacingError } from 'genkit';
   *
   * const authProvider: ContextProvider = async (req) => {
   *   const token = req.headers['authorization'];
   *   if (!token) {
   *     throw new UserFacingError('UNAUTHENTICATED', 'Missing auth token');
   *   }
   *   const user = await verifyToken(token);
   *   return { auth: { user } };
   * };
   *
   * export const handler = onCallGenkit(
   *   { contextProvider: authProvider },
   *   myFlow
   * );
   * ```
   */
  contextProvider?: ContextProvider<C, T>;

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
   * Whether to log incoming events (for debugging).
   * @default false
   */
  debug?: boolean;

  /**
   * Whether to return a streaming Lambda handler instead of a standard one.
   * When true, `onCallGenkit` returns a `StreamifyHandler` that uses
   * `awslambda.streamifyResponse` for real incremental streaming via
   * Lambda Function URLs with `InvokeMode: RESPONSE_STREAM`.
   *
   * The streaming handler is compatible with `streamFlow` from `genkit/beta/client`.
   * For clients sending `Accept: text/event-stream`, it writes SSE chunks
   * incrementally. Otherwise it falls back to a buffered JSON response.
   *
   * @default false
   *
   * @example
   * ```typescript
   * export const handler = onCallGenkit(
   *   { streaming: true },
   *   myStreamingFlow
   * );
   * ```
   */
  streaming?: boolean;
}

/**
 * Response wrapper for successful flow execution (callable protocol).
 * Follows the same format as express and other Genkit integrations.
 */
export interface FlowResponse<T> {
  result: T;
}

/**
 * Response wrapper for failed flow execution (callable protocol).
 * Shape matches genkit's getCallableJSON output.
 */
export interface FlowErrorResponse {
  error: {
    status: string;
    message: string;
    details?: unknown;
  };
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
  context: LambdaContext,
) => Promise<APIGatewayProxyResult>;

/**
 * Lambda handler function type for API Gateway v2
 */
export type LambdaHandlerV2 = (
  event: APIGatewayProxyEventV2,
  context: LambdaContext,
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
    }
    // If request origin is not in the allowlist, don't set the header
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
 * Parses the request body from an API Gateway event.
 * Supports the Genkit callable protocol format where input is wrapped in { data: ... }
 * as well as direct input format for convenience.
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
    const parsed = JSON.parse(body);
    // Support callable protocol: { data: <input> }
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch {
    throw new UserFacingError(
      "INVALID_ARGUMENT",
      "Invalid JSON in request body",
    );
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
 * Converts Lambda event headers to lowercase record (as required by RequestData)
 */
function normalizeHeaders(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
}

/**
 * Converts Lambda event to Genkit RequestData format
 */
function toRequestData<T>(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  input: T,
): RequestData<T> {
  // Determine HTTP method
  const method =
    "httpMethod" in event
      ? event.httpMethod
      : event.requestContext?.http?.method || "POST";

  return {
    method: method as RequestData["method"],
    headers: normalizeHeaders(event.headers),
    input,
  };
}

/**
 * Creates a Lambda handler for a Genkit flow.
 *
 * This function wraps a Genkit flow to create an AWS Lambda handler that:
 * - Handles CORS automatically
 * - Supports ContextProvider for authentication/authorization
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
 * @example With ContextProvider for authentication
 * ```typescript
 * import { UserFacingError, getContext } from 'genkit';
 * import type { ContextProvider } from 'genkit/context';
 *
 * interface AuthContext {
 *   auth: { user: { id: string; name: string } };
 * }
 *
 * const authProvider: ContextProvider<AuthContext> = async (req) => {
 *   const token = req.headers['authorization'];
 *   if (!token) {
 *     throw new UserFacingError('UNAUTHENTICATED', 'Missing auth token');
 *   }
 *   const user = await verifyToken(token);
 *   return { auth: { user } };
 * };
 *
 * // In your flow, access context via getContext()
 * const myFlow = ai.defineFlow(
 *   { name: 'myFlow', inputSchema: z.string(), outputSchema: z.string() },
 *   async (input, { context }) => {
 *     const { auth } = context;
 *     console.log('User:', auth.user.name);
 *     // ...
 *   }
 * );
 *
 * export const handler = onCallGenkit(
 *   { contextProvider: authProvider },
 *   myFlow
 * );
 * ```
 *
 * @param flow - The Genkit flow to wrap
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
 * @returns A Lambda handler function, or a StreamifyHandler when `streaming: true`
 */
export function onCallGenkit<C extends ActionContext, F extends Flow>(
  opts: LambdaOptions<C, FlowInput<F>> & { streaming: true },
  flow: F,
): StreamifyHandler<APIGatewayProxyEventV2, void>;

export function onCallGenkit<C extends ActionContext, F extends Flow>(
  opts: LambdaOptions<C, FlowInput<F>>,
  flow: F,
): CallableLambdaFunction<F>;

/**
 * Implementation of onCallGenkit
 */
export function onCallGenkit<C extends ActionContext, F extends Flow>(
  optsOrFlow: F | LambdaOptions<C, FlowInput<F>>,
  flowArg?: F,
): CallableLambdaFunction<F> | StreamifyHandler<APIGatewayProxyEventV2, void> {
  let opts: LambdaOptions<C, FlowInput<F>>;
  let flow: F;

  if (arguments.length === 1) {
    opts = {};
    flow = optsOrFlow as F;
  } else {
    opts = optsOrFlow as LambdaOptions<C, FlowInput<F>>;
    flow = flowArg as F;
  }

  const flowName = flow.__action?.name || "unknown";

  const handler: LambdaHandler = async (
    event: APIGatewayProxyEvent,
    lambdaContext: LambdaContext,
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
      console.log(
        `[${flowName}] Context:`,
        JSON.stringify(lambdaContext, null, 2),
      );
    }

    try {
      // Parse request body
      const input = parseRequestBody<FlowInput<F>>(event);

      // Build Lambda-specific context
      const lambdaActionContext: LambdaActionContext = {
        lambda: {
          event: {
            requestContext: event.requestContext as unknown as Record<
              string,
              unknown
            >,
            headers: event.headers as Record<string, string | undefined>,
            queryStringParameters: event.queryStringParameters,
            pathParameters: event.pathParameters,
          },
          context: {
            functionName: lambdaContext.functionName,
            functionVersion: lambdaContext.functionVersion,
            invokedFunctionArn: lambdaContext.invokedFunctionArn,
            memoryLimitInMB: lambdaContext.memoryLimitInMB,
            awsRequestId: lambdaContext.awsRequestId,
          },
        },
      };

      // Run context provider if provided
      let actionContext: ActionContext = lambdaActionContext;
      if (opts.contextProvider) {
        const requestData = toRequestData(event, input);
        const providerContext = await opts.contextProvider(requestData);
        // Merge provider context with Lambda context
        actionContext = {
          ...lambdaActionContext,
          ...providerContext,
        };
      }

      if (opts.debug) {
        console.log(`[${flowName}] Running flow with input:`, input);
      }

      // Execute the flow with context
      const runResult = await flow.run(input, { context: actionContext });
      const result = runResult.result as FlowOutput<F>;

      if (opts.debug) {
        console.log(`[${flowName}] Flow completed successfully`);
      }

      // Return success response (callable protocol)
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          result,
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
            error: {
              status: "INTERNAL",
              message: customError.message,
            },
          } satisfies FlowErrorResponse),
        };
      }

      // Use Genkit's callable error format (same as express handler)
      return {
        statusCode: getHttpStatus(error),
        headers: corsHeaders,
        body: JSON.stringify(getCallableJSON(error)),
      };
    }
  };

  // Attach additional properties to the handler
  const callableFunction = handler as CallableLambdaFunction<F>;
  callableFunction.flow = flow;
  callableFunction.flowName = flowName;

  // If streaming mode, return the streaming handler directly
  if (opts.streaming) {
    return awslambda.streamifyResponse(
      async (
        event: APIGatewayProxyEventV2,
        responseStream: awslambda.HttpResponseStream,
        lambdaCtx: LambdaContext,
      ): Promise<void> => {
        const requestOrigin = getRequestOrigin(event);
        const corsHeaders = buildCorsHeaders(opts.cors, requestOrigin);

        // Handle OPTIONS preflight
        const method = event.requestContext?.http?.method || "POST";
        if (method === "OPTIONS") {
          const httpStream = awslambda.HttpResponseStream.from(responseStream, {
            statusCode: 204,
            headers: corsHeaders,
          });
          httpStream.end();
          return;
        }

        if (opts.debug) {
          console.log(
            `[${flowName}] Stream event:`,
            JSON.stringify(event, null, 2),
          );
        }

        try {
          const input = parseRequestBody<FlowInput<F>>(event);

          // Build context
          const lambdaActionContext: LambdaActionContext = {
            lambda: {
              event: {
                requestContext: event.requestContext as unknown as Record<
                  string,
                  unknown
                >,
                headers: event.headers as Record<string, string | undefined>,
                queryStringParameters: event.queryStringParameters as Record<
                  string,
                  string | undefined
                > | null,
                pathParameters: event.pathParameters as Record<
                  string,
                  string | undefined
                > | null,
              },
              context: {
                functionName: lambdaCtx.functionName,
                functionVersion: lambdaCtx.functionVersion,
                invokedFunctionArn: lambdaCtx.invokedFunctionArn,
                memoryLimitInMB: lambdaCtx.memoryLimitInMB,
                awsRequestId: lambdaCtx.awsRequestId,
              },
            },
          };

          let actionContext: ActionContext = lambdaActionContext;
          if (opts.contextProvider) {
            const requestData = toRequestData(event, input);
            const providerContext = await opts.contextProvider(requestData);
            actionContext = { ...lambdaActionContext, ...providerContext };
          }

          // Check if client wants SSE streaming
          const acceptHeader =
            event.headers?.["accept"] || event.headers?.["Accept"] || "";
          const clientWantsStreaming =
            acceptHeader.includes("text/event-stream");

          if (clientWantsStreaming) {
            // Real streaming: write SSE events incrementally
            const httpStream = awslambda.HttpResponseStream.from(
              responseStream,
              {
                statusCode: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                  Connection: "keep-alive",
                },
              },
            );

            const { stream, output } = flow.stream(input, {
              context: actionContext,
            });

            for await (const chunk of stream) {
              httpStream.write(
                `data: ${JSON.stringify({ message: chunk })}\n\n`,
              );
            }

            const result = (await output) as FlowOutput<F>;
            httpStream.write(`data: ${JSON.stringify({ result })}\n\n`);
            httpStream.end();

            if (opts.debug) {
              console.log(
                `[${flowName}] Streaming flow completed successfully`,
              );
            }
          } else {
            // Non-streaming: buffered JSON response
            const runResult = await flow.run(input, {
              context: actionContext,
            });
            const result = runResult.result as FlowOutput<F>;

            const httpStream = awslambda.HttpResponseStream.from(
              responseStream,
              {
                statusCode: 200,
                headers: corsHeaders,
              },
            );
            httpStream.write(JSON.stringify({ result }));
            httpStream.end();
          }
        } catch (error) {
          console.error(`[${flowName}] Stream error:`, error);

          let statusCode = getHttpStatus(error);
          let body: string;

          if (opts.onError) {
            const customError = await opts.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
            statusCode = customError.statusCode;
            body = JSON.stringify({
              error: {
                status: "INTERNAL",
                message: customError.message,
              },
            });
          } else {
            body = JSON.stringify(getCallableJSON(error));
          }

          const httpStream = awslambda.HttpResponseStream.from(
            responseStream,
            {
              statusCode,
              headers: corsHeaders,
            },
          );
          httpStream.write(body);
          httpStream.end();
        }
      },
    );
  }

  return callableFunction;
}

// ============================================================================
// Context Provider Helpers
// ============================================================================

/**
 * Context with API key authentication
 */
export interface ApiKeyContext extends ActionContext {
  auth: {
    apiKey: string;
  };
}

/**
 * Context with bearer token authentication
 */
export interface BearerTokenContext extends ActionContext {
  auth: {
    token: string;
  };
}

/**
 * Creates a context provider that requires an API key in a specific header.
 *
 * @example
 * ```typescript
 * // Require API key to match a specific value
 * export const handler = onCallGenkit(
 *   { contextProvider: requireApiKey('X-API-Key', process.env.API_KEY!) },
 *   myFlow
 * );
 *
 * // Or with a custom validation function
 * export const handler = onCallGenkit(
 *   {
 *     contextProvider: requireApiKey('X-API-Key', async (key) => {
 *       const valid = await validateApiKey(key);
 *       if (!valid) {
 *         throw new UserFacingError('PERMISSION_DENIED', 'Invalid API key');
 *       }
 *     })
 *   },
 *   myFlow
 * );
 * ```
 */
export function requireApiKey(
  headerName: string,
  expectedValueOrValidator: string | ((apiKey: string) => void | Promise<void>),
): ContextProvider<ApiKeyContext> {
  const lowerHeaderName = headerName.toLowerCase();

  return async (request: RequestData): Promise<ApiKeyContext> => {
    const apiKey = request.headers[lowerHeaderName];

    if (!apiKey) {
      throw new UserFacingError(
        "UNAUTHENTICATED",
        `Missing required header: ${headerName}`,
      );
    }

    if (typeof expectedValueOrValidator === "string") {
      if (apiKey !== expectedValueOrValidator) {
        throw new UserFacingError("PERMISSION_DENIED", "Invalid API key");
      }
    } else {
      await expectedValueOrValidator(apiKey);
    }

    return {
      auth: { apiKey },
    };
  };
}

/**
 * Creates a context provider that requires Bearer token authentication.
 *
 * @example
 * ```typescript
 * // With custom token validation
 * export const handler = onCallGenkit(
 *   {
 *     contextProvider: requireBearerToken(async (token) => {
 *       const user = await verifyJWT(token);
 *       return { auth: { user } };
 *     })
 *   },
 *   myFlow
 * );
 * ```
 */
export function requireBearerToken<
  C extends ActionContext = BearerTokenContext,
>(validateToken: (token: string) => C | Promise<C>): ContextProvider<C> {
  return async (request: RequestData): Promise<C> => {
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new UserFacingError(
        "UNAUTHENTICATED",
        "Missing Authorization header",
      );
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UserFacingError(
        "UNAUTHENTICATED",
        "Invalid Authorization header format. Expected: Bearer <token>",
      );
    }

    const token = match[1];
    return await validateToken(token);
  };
}

/**
 * Creates a context provider that requires a specific header to be present.
 *
 * @example
 * ```typescript
 * // Require header to exist
 * export const handler = onCallGenkit(
 *   { contextProvider: requireHeader('X-Request-ID') },
 *   myFlow
 * );
 *
 * // Require header to have specific value
 * export const handler = onCallGenkit(
 *   { contextProvider: requireHeader('X-API-Version', '2.0') },
 *   myFlow
 * );
 * ```
 */
export function requireHeader(
  headerName: string,
  expectedValue?: string,
): ContextProvider<ActionContext> {
  const lowerHeaderName = headerName.toLowerCase();

  return async (request: RequestData): Promise<ActionContext> => {
    const value = request.headers[lowerHeaderName];

    if (!value) {
      throw new UserFacingError(
        "UNAUTHENTICATED",
        `Missing required header: ${headerName}`,
      );
    }

    if (expectedValue !== undefined && value !== expectedValue) {
      throw new UserFacingError(
        "PERMISSION_DENIED",
        `Invalid value for header: ${headerName}`,
      );
    }

    return {};
  };
}

/**
 * Creates a context provider that always allows requests (no authentication).
 * Useful for public endpoints.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   { contextProvider: allowAll() },
 *   myPublicFlow
 * );
 * ```
 */
export function allowAll(): ContextProvider<ActionContext> {
  return async (): Promise<ActionContext> => ({});
}

/**
 * Combines multiple context providers. All providers must succeed.
 * The returned context is a merge of all provider contexts.
 *
 * @example
 * ```typescript
 * export const handler = onCallGenkit(
 *   {
 *     contextProvider: allOf(
 *       requireHeader('X-Request-ID'),
 *       requireApiKey('X-API-Key', process.env.API_KEY!)
 *     )
 *   },
 *   myFlow
 * );
 * ```
 */
export function allOf<C extends ActionContext = ActionContext>(
  ...providers: ContextProvider<ActionContext>[]
): ContextProvider<C> {
  return async (request: RequestData): Promise<C> => {
    let mergedContext: ActionContext = {};

    for (const provider of providers) {
      const context = await provider(request);
      mergedContext = { ...mergedContext, ...context };
    }

    return mergedContext as C;
  };
}

/**
 * Tries context providers in order, returning the first one that succeeds.
 * If all providers fail, throws the error from the last provider.
 *
 * @example
 * ```typescript
 * // Accept either API key or Bearer token
 * export const handler = onCallGenkit(
 *   {
 *     contextProvider: anyOf(
 *       requireApiKey('X-API-Key', process.env.API_KEY!),
 *       requireBearerToken(async (token) => {
 *         const user = await verifyJWT(token);
 *         return { auth: { user } };
 *       })
 *     )
 *   },
 *   myFlow
 * );
 * ```
 */
export function anyOf<C extends ActionContext = ActionContext>(
  ...providers: ContextProvider<ActionContext>[]
): ContextProvider<C> {
  return async (request: RequestData): Promise<C> => {
    let lastError: Error | undefined;

    for (const provider of providers) {
      try {
        const context = await provider(request);
        return context as C;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new UserFacingError("UNAUTHENTICATED", "Unauthorized");
  };
}

export default onCallGenkit;
