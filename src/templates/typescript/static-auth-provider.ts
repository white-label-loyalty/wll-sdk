import type { AuthProvider, Region } from './auth-provider';

export type StaticAuthConfig = {
  token: string;
};

export class StaticAuthProvider implements AuthProvider {
  private _config: StaticAuthConfig;

  constructor(config: StaticAuthConfig) {
    this._config = config;
  }

  public getToken(region: Region): Promise<string> {
    return Promise.resolve(this._config.token);
  }
}
