import { Command } from 'commander';
import { createGateway } from './gateway'
import { logger } from './logs';
import { Config } from './schema';

const program = new Command();

program
  .option('-r, --run', 'Run the gateway')
  .option('-p, --port', 'Port to run on, default is 3000')
  .option('-c, --config', 'JavaScript configuration file to be imported')

program.parse();
const options = program.opts();

async function start() {
  const configModule = options.config || './configuration'
  const config: Config = (await import(configModule)).getConfig()
  
  const port = options.port || 3000
  
  if(options.run) {
    const gateway = createGateway(config, port)
    const shutdown = () => {
      logger.log('SIGTERM signal received. Shutting down.');
      gateway.close(() => {
        logger.log('Donkey gateway closed.');
        process.exit(0);
      });
    }
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }  
}

start()




