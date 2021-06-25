import { Command } from 'commander';
import { createGateway } from './gateway'
import { Config } from './schema';

const program = new Command();

program
  .option('-r, --run', 'Run the gateway')
  .option('-c, --config', 'JavaScript configuration file to be imported')

program.parse();
const options = program.opts();

const configModule = options.config || './configuration'
const config: Config = import(configModule) as any

if(options.run) {
  const gateway = createGateway(config)
}



