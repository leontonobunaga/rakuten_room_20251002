import { z } from 'zod';

const timeRangeSchema = z
  .object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
      message: 'start must be HH:MM (24h)',
    }),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
      message: 'end must be HH:MM (24h)',
    }),
  })
  .strict();

const runSchema = z
  .object({
    mode: z.enum(['safe', 'auto']).default('safe'),
    headless: z.boolean().default(false),
    daily_cap: z.number().int().nonnegative().default(100),
    min_interval_sec: z.number().nonnegative().default(60),
    max_interval_sec: z.number().nonnegative().default(180),
    jitter: z.number().min(0).max(1).default(0.25),
    blackout: z.array(timeRangeSchema).default([]),
    max_errors_per_hour: z.number().int().nonnegative().default(3),
    hard_stop_on_error: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.max_interval_sec < value.min_interval_sec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_interval_sec'],
        message: 'max_interval_sec must be >= min_interval_sec',
      });
    }
  });

const browserSchema = z
  .object({
    channel: z.string().optional(),
    executable_path: z.string().optional(),
    storage_state: z.string().default('./data/session.json'),
  })
  .strict()
  .refine(
    (value) => value.channel !== undefined || value.executable_path !== undefined,
    'browser.channel or browser.executable_path is required',
  );

const credentialsSchema = z
  .object({
    applicationId: z.string().min(1, 'applicationId is required'),
    affiliateId: z.string().optional(),
  })
  .strict();

const sourcesSchema = z
  .object({
    keywords: z.array(z.string()).default([]),
    exclude_keywords: z.array(z.string()).default([]),
    genre_ids: z.array(z.string()).default([]),
    min_price: z.number().int().nonnegative().optional(),
    max_price: z.number().int().nonnegative().optional(),
    min_review_count: z.number().int().nonnegative().optional(),
    min_review_average: z.number().nonnegative().optional(),
    availability_only: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.min_price !== undefined &&
      value.max_price !== undefined &&
      value.max_price < value.min_price
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_price'],
        message: 'max_price must be >= min_price',
      });
    }
  });

const prioritySchema = z
  .object({
    genre_weights: z.record(z.number()).default({}),
    genre_quotas: z.record(z.number().int().nonnegative()).default({}),
  })
  .strict();

const bannedRegexSchema = z
  .object({
    id: z.string(),
    pattern: z.string(),
    severity: z.enum(['block', 'replace']).default('block'),
    replacement: z.string().optional(),
  })
  .strict();

const policySchema = z
  .object({
    banned_terms: z.array(z.string()).default([]),
    banned_regex: z.array(bannedRegexSchema).default([]),
    exceptions_terms: z.array(z.string()).default([]),
  })
  .strict();

const copySchema = z
  .object({
    max_len: z.number().int().positive().default(160),
    add_pr_tag: z.boolean().default(true),
    variants_per_item: z.number().int().positive().default(1),
    hashtag_presets: z.array(z.string()).default([]),
  })
  .strict();

const etlSchema = z
  .object({
    enabled: z.boolean().default(false),
    watch_dir: z.string().default('./drop'),
    schedule: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
    csv_mapping: z
      .object({
        item_code: z.string(),
        clicks: z.string(),
        purchases: z.string(),
        revenue: z.string(),
        points: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();

const openaiSchema = z
  .object({
    api_key: z.string().optional(),
    model: z.string().default('gpt-4o-mini'),
    mode: z.enum(['responses', 'chat']).default('responses'),
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().int().positive().default(280),
  })
  .strict();

const anthropicSchema = z
  .object({
    api_key: z.string().optional(),
    model: z.string().default('claude-3-haiku'),
  })
  .strict();

const googleSchema = z
  .object({
    api_key: z.string().optional(),
    model: z.string().default('gemini-1.5-flash'),
  })
  .strict();

const groqSchema = z
  .object({
    api_key: z.string().optional(),
    model: z.string().default('llama-3.1-70b-versatile'),
  })
  .strict();

const localSchema = z
  .object({
    endpoint: z.string().default('http://localhost:11434'),
    model: z.string().default('llama3.1'),
  })
  .strict();

const llmSchema = z
  .object({
    provider: z.enum(['openai', 'anthropic', 'google', 'groq', 'local']).default('openai'),
    openai: openaiSchema.optional(),
    anthropic: anthropicSchema.optional(),
    google: googleSchema.optional(),
    groq: groqSchema.optional(),
    local: localSchema.optional(),
  })
  .strict();

export const configSchema = z
  .object({
    run: runSchema,
    browser: browserSchema,
    credentials: credentialsSchema,
    sources: sourcesSchema,
    priority: prioritySchema,
    shops: z
      .object({
        allowlist: z.array(z.string()).default([]),
        denylist: z.array(z.string()).default([]),
      })
      .strict(),
    policy: policySchema,
    copy: copySchema,
    etl: etlSchema,
    llm: llmSchema,
  })
  .strict();

export type AppConfig = z.infer<typeof configSchema>;
