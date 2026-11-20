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

// The model implementation lives in focused modules. This file re-exports
// them so existing imports of "./aws_bedrock_llms.js" keep working.
export {
  getSystemMessage,
  toAwsBedrockMessages,
  toAwsBedrockRequestBody,
  toAwsBedrockTextAndMedia,
} from './converse.js';
export { awsBedrockModel } from './generate.js';
export * from './models.js';
