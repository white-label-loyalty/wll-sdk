import { AuthProvider, Region } from "./auth-provider";

export type Auth0Payload = {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
};

export type AdminAuthConfig = {
  clientId: string,
  clientSecret: string,
  grantType?: string,
  audience?: string,
  scope?: string
}

type InternalConfig = AdminAuthConfig & Required<Pick<AdminAuthConfig, 'grantType' | 'audience'>>

export class AdminAuthProvider implements AuthProvider {
  private _config: InternalConfig;
  private _accessToken?: string;
  private _expiresAt?: number;

  constructor(
    config: AdminAuthConfig
  ) {
    const mergedConfig = {
      grantType: 'client_credentials',
      audience: 'wlloyalty.net',
      ...config
    } satisfies InternalConfig

   this._config = mergedConfig;
  }

  public async getToken(region: Region) {
    if(this._accessToken && this._expiresAt && this._expiresAt > Date.now() / 1000 ) {
      return this._accessToken;
    }

    let authUrl: string;

    switch(region) {
      case Region.EU:
        authUrl = 'https://auth.wlloyalty.net';
        break;
      case Region.US:
        authUrl = 'https://auth.us.wlloyalty.net'
        break;
      default:
        throw new Error("Region not supported by this version of SDK.");
    }

    const headers = new Headers();
    headers.set("content-type", "application/json");
    const { access_token, expires_in } = await fetch(`${authUrl}/oauth/token`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: this._config.clientId,
        client_secret: this._config.clientSecret,
        grant_type: this._config.grantType,
        audience: this._config.audience,
        scope: this._config.scope
      }),
      headers
    }).then(async(data) => await data.json() as Auth0Payload).catch((err) => {
      console.warn('Error fetching token', err);
      throw new Error(err);
    });

    this._accessToken = access_token;
    this._expiresAt = Math.floor(Date.now() / 1000) + expires_in

    return access_token;
  }
}