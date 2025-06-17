import {Args, Command, Flags} from '@oclif/core'
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import { TypescriptGenerator } from '../generators/typescript';

export default class Generate extends Command {
  static override args = {
    url: Args.url({description: 'The URl to fetch the file from', required: true }),
  }

  static override aliases = ['gen'];
  static override description = 'Generate a new SDK based on the OpenAPI spec with the given language'

  static override examples = [
    '<%= command.id %> file://path/to/openapi.json',
    '<%= command.id %> --language typescript file://path/to/openapi.json',
    '<%= command.id %> -l typescript file://path/to/openapi.json',
    '<%= command.id %> -l python file://path/to/openapi.json',
    `${this.aliases[0]} -l typescript file://path/to/openapi.json`,
  ]


  static override flags = {
    help: Flags.help({char: 'h'}),
    language: Flags.string({ char: 'l', description: 'The language to generate the SDK for', options: ['typescript', 'python', 'java'], default: 'typescript'}),
    apiKey: Flags.string({ char: 'k', description: 'The API key to use when fetching the OpenAPI spec (if needed)'})
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(Generate)
    
    const { language } = flags;
    const { url } = args;
    
    let spec: OpenAPIV3.Document | null = null;

    try {
      const res = await fetch(url, {
        headers: flags.apiKey ? { 'x-api-key': flags.apiKey } : undefined
      });
      if(!res.ok) {
        throw new Error(`Request failed with: ${res.status} ${res.statusText}`)
      }
      spec = await res.json() as OpenAPIV3.Document;
    } catch (err) {
      this.error(`Failed to fetch the OpenAPI spec from ${url}: ${err}`);
      return;
    }

    switch(language) {
      case 'python':
        this.log('Generating python SDK...');
        break;
      case 'java':
        this.log('Generating java SDK...');
        break;
      default: 
      case 'typescript':
        this.log('Generating typescript SDK...');
        const generator = new TypescriptGenerator(spec);
        await generator.generateSdk();
        break;
    }
    
  }
}
