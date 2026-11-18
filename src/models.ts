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
/* eslint-disable  @typescript-eslint/no-explicit-any */

import { ModelReference } from 'genkit';
import { modelRef } from 'genkit/model';

import { AwsBedrockConfigSchema } from './types.js';

export const amazonNova2LiteV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.amazon.nova-2-lite-v1:0`,
    info: {
      versions: [`${inferenceRegion}.amazon.nova-2-lite-v1:0`],
      label: 'Amazon - Nova 2 Lite V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const amazonNovaPremierV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.amazon.nova-premier-v1:0`,
    info: {
      versions: [`${inferenceRegion}.amazon.nova-premier-v1:0`],
      label: 'Amazon - Nova Premier V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const amazonNovaProV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.amazon.nova-pro-v1:0`,
    info: {
      versions: [`${inferenceRegion}.amazon.nova-pro-v1:0`],
      label: 'Amazon - Nova Pro V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const amazonNovaLiteV1 = modelRef({
  name: 'aws-bedrock/amazon.nova-lite-v1:0',
  info: {
    versions: ['amazon.nova-lite-v1:0'],
    label: 'Amazon - Nova Lite V1',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const amazonNovaMicroV1 = modelRef({
  name: 'aws-bedrock/amazon.nova-micro-v1:0',
  info: {
    versions: ['amazon.nova-micro-v1:0'],
    label: 'Amazon - Nova Micro V1',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const amazonTitanTextG1PremierV1 = modelRef({
  name: 'aws-bedrock/amazon.titan-text-premier-v1:0',
  info: {
    versions: ['amazon.titan-text-premier-v1:0'],
    label: 'Amazon - Titan Text Premier G1 V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const amazonTitanTextG1ExpressV1 = modelRef({
  name: 'aws-bedrock/amazon.titan-text-express-v1',
  info: {
    versions: ['amazon.titan-text-express-v1'],
    label: 'Amazon - Titan Text Express G1 V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const amazonTitanTextG1LiteV1 = modelRef({
  name: 'aws-bedrock/amazon.titan-text-lite-v1',
  info: {
    versions: ['amazon.titan-text-lite-v1'],
    label: 'Amazon - Titan Text Lite G1 V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const googleGemma312BIt = modelRef({
  name: 'aws-bedrock/google.gemma-3-12b-it',
  info: {
    versions: ['google.gemma-3-12b-it'],
    label: 'Google - Gemma 3 12B IT',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const cohereRerank35V1 = modelRef({
  name: 'aws-bedrock/cohere.rerank-v3-5:0',
  info: {
    versions: ['cohere.rerank-v3-5:0'],
    label: 'Cohere - Rerank 3.5',
    supports: {
      multiturn: false,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const cohereCommandRV1 = modelRef({
  name: 'aws-bedrock/cohere.command-r-v1:0',
  info: {
    versions: ['cohere.command-r-v1:0'],
    label: 'Cohere - Command R',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const cohereCommandRPlusV1 = modelRef({
  name: 'aws-bedrock/cohere.command-r-plus-v1:0',
  info: {
    versions: ['cohere.command-r-plus-v1:0'],
    label: 'Cohere - Command R+',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const cohereCommandLightV14 = modelRef({
  name: 'aws-bedrock/cohere.command-light-text-v14',
  info: {
    versions: ['cohere.command-light-text-v14'],
    label: 'Cohere - Command Light V14',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const cohereCommandV14 = modelRef({
  name: 'aws-bedrock/cohere.command-text-v14',
  info: {
    versions: ['cohere.command-text-v14'],
    label: 'Cohere - Command V14',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const anthropicClaudeSonnet4V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-sonnet-4-20250514-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-sonnet-4-20250514-v1:0`],
      label: 'Anthropic - Claude Sonnet 4 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeOpus4V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-opus-4-20250514-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-opus-4-20250514-v1:0`],
      label: 'Anthropic - Claude Opus 4 (Legacy) V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeOpus41V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-opus-4-1-20250805-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-opus-4-1-20250805-v1:0`],
      label: 'Anthropic - Claude Opus 4.1 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeSonnet45V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-sonnet-4-5-20250929-v1:0`,
    info: {
      versions: [
        `${inferenceRegion}.anthropic.claude-sonnet-4-5-20250929-v1:0`,
      ],
      label: 'Anthropic - Claude Sonnet 4.5 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
        constrained: 'all',
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeHaiku45V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-haiku-4-5-20251001-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-haiku-4-5-20251001-v1:0`],
      label: 'Anthropic - Claude Haiku 4.5 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
        constrained: 'all',
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeOpus45V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-opus-4-5-20251101-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-opus-4-5-20251101-v1:0`],
      label: 'Anthropic - Claude Opus 4.5 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
        constrained: 'all',
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeOpus46V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-opus-4-6-v1`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-opus-4-6-v1`],
      label: 'Anthropic - Claude Opus 4.6 V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
        constrained: 'all',
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaudeSonnet46V1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-sonnet-4-6`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-sonnet-4-6`],
      label: 'Anthropic - Claude Sonnet 4.6',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
        constrained: 'all',
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude35HaikuV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-5-haiku-20241022-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-3-5-haiku-20241022-v1:0`],
      label: 'Anthropic - Claude 3.5 Haiku V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude3HaikuV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-haiku-20240307-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-3-haiku-20240307-v1:0`],
      label: 'Anthropic - Claude 3 Haiku V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude3OpusV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-opus-20240229-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-3-opus-20240229-v1:0`],
      label: 'Anthropic - Claude 3 Opus V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude37SonnetV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-7-sonnet-20250219-v1:0`,
    info: {
      versions: [
        `${inferenceRegion}.anthropic.claude-3-7-sonnet-20250219-v1:0`,
      ],
      label: 'Anthropic - Claude 3.7 Sonnet V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude35SonnetV2 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-5-sonnet-20241022-v2:0`,
    info: {
      versions: [
        `${inferenceRegion}.anthropic.claude-3-5-sonnet-20241022-v2:0`,
      ],
      label: 'Anthropic - Claude 3.5 Sonnet V2',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude35SonnetV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-5-sonnet-20240620-v1:0`,
    info: {
      versions: [
        `${inferenceRegion}.anthropic.claude-3-5-sonnet-20240620-v1:0`,
      ],
      label: 'Anthropic - Claude 3.5 Sonnet V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude3SonnetV1 = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.anthropic.claude-3-sonnet-20240229-v1:0`,
    info: {
      versions: [`${inferenceRegion}.anthropic.claude-3-sonnet-20240229-v1:0`],
      label: 'Anthropic - Claude 3 Sonnet V1',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const anthropicClaude21V1 = modelRef({
  name: 'aws-bedrock/anthropic.claude-v2:1',
  info: {
    versions: ['anthropic.claude-v2:1'],
    label: 'Anthropic - Claude 2.1 V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const anthropicClaude2V1 = modelRef({
  name: 'aws-bedrock/anthropic.claude-v2',
  info: {
    versions: ['anthropic.claude-v2'],
    label: 'Anthropic - Claude 2 V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const anthropicClaudeInstantV1 = modelRef({
  name: 'aws-bedrock/anthropic.claude-instant-v1',
  info: {
    versions: ['anthropic.claude-instant-v1'],
    label: 'Anthropic - Claude Instant V1',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralMagistralSmall2509 = modelRef({
  name: 'aws-bedrock/mistral.magistral-small-2509',
  info: {
    versions: ['mistral.magistral-small-2509'],
    label: 'Mistral - Magistral Small 2509',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralMinistral314BInstruct = modelRef({
  name: 'aws-bedrock/mistral.ministral-3-14b-instruct',
  info: {
    versions: ['mistral.ministral-3-14b-instruct'],
    label: 'Mistral - Ministral 3 14B Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralMinistral38BInstruct = modelRef({
  name: 'aws-bedrock/mistral.ministral-3-8b-instruct',
  info: {
    versions: ['mistral.ministral-3-8b-instruct'],
    label: 'Mistral - Ministral 3 8B Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralMinistral33BInstruct = modelRef({
  name: 'aws-bedrock/mistral.ministral-3-3b-instruct',
  info: {
    versions: ['mistral.ministral-3-3b-instruct'],
    label: 'Mistral - Ministral 3 3B Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralLarge3675BInstruct = modelRef({
  name: 'aws-bedrock/mistral.mistral-large-3-675b-instruct',
  info: {
    versions: ['mistral.mistral-large-3-675b-instruct'],
    label: 'Mistral - Large 3 (675B) Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
      constrained: 'all',
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const pixtralLarge2502V1 = modelRef({
  name: 'aws-bedrock/mistral.pixtral-large-2502-v1:0',
  info: {
    versions: ['mistral.pixtral-large-2502-v1:0'],
    label: 'Mistral - Pixtral Large (25.02)',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: true,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralLarge2402V1 = modelRef({
  name: 'aws-bedrock/mistral.mistral-large-2402-v1:0',
  info: {
    versions: ['mistral.mistral-large-2402-v1:0'],
    label: 'Mistral - Large (24.02)',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistralSmall2402V1 = modelRef({
  name: 'aws-bedrock/mistral.mistral-small-2402-v1:0',
  info: {
    versions: ['mistral.mistral-small-2402-v1:0'],
    label: 'Mistral - Small (24.02)',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistral7BInstructV02 = modelRef({
  name: 'aws-bedrock/mistral.mistral-7b-instruct-v0:2',
  info: {
    versions: ['mistral.mistral-7b-instruct-v0:2'],
    label: 'Mistral - 7B Instruct',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const mistral8x7BInstructV01 = modelRef({
  name: 'aws-bedrock/mistral.mixtral-8x7b-instruct-v0:1',
  info: {
    versions: ['mistral.mixtral-8x7b-instruct-v0:1'],
    label: 'Mistral - 8x7B Instruct',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const ai21Jamba15LargeV1 = modelRef({
  name: 'aws-bedrock/ai21.jamba-1-5-large-v1:0',
  info: {
    versions: ['ai21.jamba-1-5-large-v1:0'],
    label: 'AI21 - Jambda 1.5 Large',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const ai21Jamba15MiniV1 = modelRef({
  name: 'aws-bedrock/ai21.jamba-1-5-mini-v1:0',
  info: {
    versions: ['ai21.jamba-1-5-mini-v1:0'],
    label: 'AI21 - Jambda 1.5 Mini',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const ai21JambaInstructV1 = modelRef({
  name: 'aws-bedrock/ai21.jamba-instruct-v1:0',
  info: {
    versions: ['ai21.jamba-instruct-v1:0'],
    label: 'AI21 - Jambda Instruct',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const ai21Jurassic2MidV1 = modelRef({
  name: 'aws-bedrock/ai21.j2-mid-v1',
  info: {
    versions: ['ai21.j2-mid-v1'],
    label: 'AI21 - Jurassic-2 Mid',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const ai21Jurassic2UltraV1 = modelRef({
  name: 'aws-bedrock/ai21.j2-ultra-v1',
  info: {
    versions: ['ai21.j2-ultra-v1'],
    label: 'AI21 - Jurassic-2 Ultra',
    supports: {
      multiturn: true,
      tools: false,
      media: false,
      systemRole: false,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const metaLlama4Maverick17BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama4-maverick-17b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama4-maverick-17b-instruct-v1:0`],
      label: 'Meta - Llama 4 Maverick 17b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama4Scout17BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama4-scout-17b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama4-scout-17b-instruct-v1:0`],
      label: 'Meta - Llama 4 Scout 17b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama3370BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-3-70b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-3-70b-instruct-v1:0`],
      label: 'Meta - Llama 3.3 70b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama3211BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-2-11b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-2-11b-instruct-v1:0`],
      label: 'Meta - Llama 3.2 11b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama321BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-2-1b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-2-1b-instruct-v1:0`],
      label: 'Meta - Llama 3.2 1b Instruct',
      supports: {
        multiturn: true,
        tools: false,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama323BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-2-3b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-2-3b-instruct-v1:0`],
      label: 'Meta - Llama 3.2 3b Instruct',
      supports: {
        multiturn: true,
        tools: false,
        media: false,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama3290BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-2-90b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-2-90b-instruct-v1:0`],
      label: 'Meta - Llama 3.2 90b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama3170BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-1-70b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-1-70b-instruct-v1:0`],
      label: 'Meta - Llama 3.1 70b Instruct',
      supports: {
        multiturn: true,
        tools: false,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama318BInstruct = (
  inferenceRegion: string = 'us'
): ModelReference<typeof AwsBedrockConfigSchema> => {
  return modelRef({
    name: `aws-bedrock/${inferenceRegion}.meta.llama3-1-8b-instruct-v1:0`,
    info: {
      versions: [`${inferenceRegion}.meta.llama3-1-8b-instruct-v1:0`],
      label: 'Meta - Llama 3.1 8b Instruct',
      supports: {
        multiturn: true,
        tools: true,
        toolChoice: true,
        media: true,
        systemRole: true,
        output: ['text', 'json'],
      },
    },
    configSchema: AwsBedrockConfigSchema,
  });
};

export const metaLlama370BInstruct = modelRef({
  name: 'aws-bedrock/meta.llama3-70b-instruct-v1:0',
  info: {
    versions: ['meta.llama3-70b-instruct-v1:0'],
    label: 'Meta - Llama 3 70b Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const metaLlama38BInstruct = modelRef({
  name: 'aws-bedrock/meta.llama3-8b-instruct-v1:0',
  info: {
    versions: ['meta.llama3-8b-instruct-v1:0'],
    label: 'Meta - Llama 3 8b Instruct',
    supports: {
      multiturn: true,
      tools: true,
      toolChoice: true,
      media: false,
      systemRole: true,
      output: ['text', 'json'],
    },
  },
  configSchema: AwsBedrockConfigSchema,
});

export const SUPPORTED_AWS_BEDROCK_MODELS = (
  inferenceRegion: string = 'us'
): Record<string, any> => {
  return {
    [`${inferenceRegion}.amazon.nova-pro-v1:0`]:
      amazonNovaProV1(inferenceRegion),
    'amazon.nova-lite-v1:0': amazonNovaLiteV1,
    'amazon.nova-micro-v1:0': amazonNovaMicroV1,
    'amazon.titan-text-premier-v1:0': amazonTitanTextG1PremierV1,
    'amazon.titan-text-express-v1': amazonTitanTextG1ExpressV1,
    'amazon.titan-text-lite-v1': amazonTitanTextG1LiteV1,
    'cohere.command-r-v1:0': cohereCommandRV1,
    'cohere.command-r-plus-v1:0': cohereCommandRPlusV1,
    'cohere.command-light-text-v14': cohereCommandLightV14,
    'cohere.command-text-v14': cohereCommandV14,
    'mistral.mistral-large-2402-v1:0': mistralLarge2402V1,
    'mistral.mistral-small-2402-v1:0': mistralSmall2402V1,
    'mistral.mistral-7b-instruct-v0:2': mistral7BInstructV02,
    'mistral.mixtral-8x7b-instruct-v0:1': mistral8x7BInstructV01,
    'ai21.jamba-1-5-large-v1:0': ai21Jamba15LargeV1,
    'ai21.jamba-1-5-mini-v1:0': ai21Jamba15MiniV1,
    'ai21.jamba-instruct-v1:0': ai21JambaInstructV1,
    'ai21.j2-mid-v1': ai21Jurassic2MidV1,
    'ai21.j2-ultra-v1': ai21Jurassic2UltraV1,
    [`${inferenceRegion}.meta.llama3-3-70b-instruct-v1:0`]:
      metaLlama3370BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-2-11b-instruct-v1:0`]:
      metaLlama3211BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-2-1b-instruct-v1:0`]:
      metaLlama321BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-2-3b-instruct-v1:0`]:
      metaLlama323BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-2-90b-instruct-v1:0`]:
      metaLlama3290BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-1-70b-instruct-v1:0`]:
      metaLlama3170BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama3-1-8b-instruct-v1:0`]:
      metaLlama318BInstruct(inferenceRegion),
    'meta.llama3-70b-instruct-v1:0': metaLlama370BInstruct,
    'meta.llama3-8b-instruct-v1:0': metaLlama38BInstruct,
    'anthropic.claude-v2:1': anthropicClaude21V1,
    'anthropic.claude-v2': anthropicClaude2V1,
    'anthropic.claude-instant-v1': anthropicClaudeInstantV1,
    [`${inferenceRegion}.anthropic.claude-3-5-haiku-20241022-v1:0`]:
      anthropicClaude35HaikuV1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-7-sonnet-20250219-v1:0`]:
      anthropicClaude37SonnetV1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-5-sonnet-20241022-v2:0`]:
      anthropicClaude35SonnetV2(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-5-sonnet-20240620-v1:0`]:
      anthropicClaude35SonnetV1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-opus-20240229-v1:0`]:
      anthropicClaude3OpusV1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-haiku-20240307-v1:0`]:
      anthropicClaude3HaikuV1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-3-sonnet-20240229-v1:0`]:
      anthropicClaude3SonnetV1(inferenceRegion),
    // Added models
    [`${inferenceRegion}.anthropic.claude-sonnet-4-20250514-v1:0`]:
      anthropicClaudeSonnet4V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-opus-4-20250514-v1:0`]:
      anthropicClaudeOpus4V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-opus-4-1-20250805-v1:0`]:
      anthropicClaudeOpus41V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-sonnet-4-5-20250929-v1:0`]:
      anthropicClaudeSonnet45V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-haiku-4-5-20251001-v1:0`]:
      anthropicClaudeHaiku45V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-opus-4-5-20251101-v1:0`]:
      anthropicClaudeOpus45V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-opus-4-6-v1`]:
      anthropicClaudeOpus46V1(inferenceRegion),
    [`${inferenceRegion}.anthropic.claude-sonnet-4-6`]:
      anthropicClaudeSonnet46V1(inferenceRegion),
    [`${inferenceRegion}.meta.llama4-maverick-17b-instruct-v1:0`]:
      metaLlama4Maverick17BInstruct(inferenceRegion),
    [`${inferenceRegion}.meta.llama4-scout-17b-instruct-v1:0`]:
      metaLlama4Scout17BInstruct(inferenceRegion),
    [`${inferenceRegion}.amazon.nova-2-lite-v1:0`]:
      amazonNova2LiteV1(inferenceRegion),
    [`${inferenceRegion}.amazon.nova-premier-v1:0`]:
      amazonNovaPremierV1(inferenceRegion),
    'mistral.magistral-small-2509': mistralMagistralSmall2509,
    'mistral.ministral-3-14b-instruct': mistralMinistral314BInstruct,
    'mistral.ministral-3-8b-instruct': mistralMinistral38BInstruct,
    'mistral.ministral-3-3b-instruct': mistralMinistral33BInstruct,
    'mistral.mistral-large-3-675b-instruct': mistralLarge3675BInstruct,
    'mistral.pixtral-large-2502-v1:0': pixtralLarge2502V1,
    'google.gemma-3-12b-it': googleGemma312BIt,
    'cohere.rerank-v3-5:0': cohereRerank35V1,
  };
};
