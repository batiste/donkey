import { Command } from 'commander';
import { createGateway } from './gateway'
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
  }  
}

start()




