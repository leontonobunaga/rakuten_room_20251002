import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import dotenv from 'dotenv';
import YAML from 'yaml';

import { AppConfig, configSchema } from './schema.js';

dotenv.config();

export type LoadConfigOptions = {
  configPath?: string;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const loadConfig = async (options: LoadConfigOptions = {}): Promise<AppConfig> => {
  const candidatePath =
    options.configPath ?? process.env.CONFIG_PATH ?? resolve(process.cwd(), 'config/config.yaml');

  let fileContent: string;
  try {
    fileContent = await readFile(candidatePath, 'utf8');
  } catch (error) {
    throw new ConfigError(`Failed to read config file at ${candidatePath}: ${(error as Error).message}`);
  }

  let parsedContent: unknown;
  try {
    parsedContent = YAML.parse(fileContent, { intAsBigInt: false });
  } catch (error) {
    throw new ConfigError(`Failed to parse YAML config: ${(error as Error).message}`);
  }

  const configResult = configSchema.safeParse(parsedContent);
  if (!configResult.success) {
    const issues = configResult.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(`Config validation failed:\n${issues}`);
  }

  return configResult.data;
};
