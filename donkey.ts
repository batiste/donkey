#!/usr/bin/env node
import { Command } from "commander";
import * as path from "path";
import { createGateway } from "./gateway";
import { logger, onShutdown } from "./logs";
import { Config } from "./schema";

const program = new Command();

program
  .option("-r, --run", "Run the gateway")
  .option("-p, --port <number>", "Port to run on", "3000")
  .option(
    "-c, --config <value>",
    "JavaScript configuration module exporting getConfig()",
    "./build/configuration"
  );

program.parse();
const options = program.opts();

async function start() {
  const pathname = path.resolve(process.cwd(), options.config);
  logger.log(`Importing configuration from ${pathname}`);
  const config: Config = await (await import(pathname)).getConfig();

  const port = parseInt(options.port, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }

  if (options.run) {
    const gateway = createGateway(config, port);
    onShutdown(() => {
      logger.log("Shutdown signal received. Shutting down now.");
      gateway.close(() => {
        logger.log("Donkey gateway shutdown.");
        process.exit(0);
      });
    });
  }
}

start().catch((error) => {
  logger.error("Failed to start the gateway", { error: String(error) });
  process.exit(1);
});
