import { loadConfig } from './config/load.js';

const main = async () => {
  const config = await loadConfig();

  console.log('Rakuten ROOM automation bootstrap');
  console.log(`Run mode: ${config.run.mode}`);
  console.log(`Daily cap: ${config.run.daily_cap}`);
  console.log(`LLM provider: ${config.llm.provider}`);
};

main().catch((error) => {
  console.error('Fatal error while starting application');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
