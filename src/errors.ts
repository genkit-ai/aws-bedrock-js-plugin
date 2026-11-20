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

import { GenkitError, StatusName } from 'genkit';

/**
 * Genkit status for each Bedrock Runtime exception name.
 */
const STATUS_BY_EXCEPTION: Record<string, StatusName> = {
  ValidationException: 'INVALID_ARGUMENT',
  AccessDeniedException: 'PERMISSION_DENIED',
  UnrecognizedClientException: 'UNAUTHENTICATED',
  ExpiredTokenException: 'UNAUTHENTICATED',
  ResourceNotFoundException: 'NOT_FOUND',
  ThrottlingException: 'RESOURCE_EXHAUSTED',
  ServiceQuotaExceededException: 'RESOURCE_EXHAUSTED',
  ModelTimeoutException: 'DEADLINE_EXCEEDED',
  ModelNotReadyException: 'UNAVAILABLE',
  ServiceUnavailableException: 'UNAVAILABLE',
  ModelStreamErrorException: 'INTERNAL',
  ModelErrorException: 'INTERNAL',
  InternalServerException: 'INTERNAL',
};

/**
 * Wraps an error from the Bedrock client in a GenkitError with a matching
 * status, so callers can tell a throttle from a bad request. The original
 * error is kept as `cause`. Errors that are already GenkitErrors, aborts, and
 * errors that aren't Bedrock exceptions are returned unchanged.
 */
export function toGenkitError(err: unknown): unknown {
  if (err instanceof GenkitError || !(err instanceof Error)) return err;
  const status = STATUS_BY_EXCEPTION[err.name];
  if (!status) return err;
  const wrapped = new GenkitError({
    status,
    message: `AWS Bedrock ${err.name}: ${err.message}`,
  });
  (wrapped as Error & { cause?: unknown }).cause = err;
  return wrapped;
}
