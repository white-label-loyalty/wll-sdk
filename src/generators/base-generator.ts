import type { OpenAPIV3 } from 'openapi-types';

export abstract class Generator {
  protected apiSpec: OpenAPIV3.Document;
  public abstract generateSdk(): Promise<void>;
  constructor(apiSpec: OpenAPIV3.Document) {
    this.apiSpec = apiSpec;
  }
}
