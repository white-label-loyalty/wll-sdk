import { AuthProvider, Region } from './auth-provider';

export class HttpBase {
  private _authProvider: AuthProvider;
  private _baseUrl: string;
  private _apiKey: string;

  constructor(authProvider: AuthProvider, baseUrl: string, apiKey: string) {
    this._baseUrl = baseUrl;
    this._authProvider = authProvider;
    this._apiKey = apiKey;
  }

  protected async invoke<T>(
    endpoint: string,
    options: {
      method: string,
      parameters?: Record<string, string>,
      query?: Record<string, any>
      headers?: Record<string, string>
      body?: any,
    }
  ): Promise<T> {
    const searchParams = new URLSearchParams();
    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      searchParams.set(key, value.toString());
    })
    let url = `${this._baseUrl}${endpoint}` + (options?.query?.length > 0 ? "?" + searchParams.toString() : '');

    const region = this._baseUrl.includes('.us.') ? 'US' : 'EU';
    let authorization = `Bearer ${await this._authProvider.getToken(
      Region[region as keyof typeof Region]
    )}`;

    if (options.headers?.['Authorization']) {
      authorization = options?.headers?.['Authorization'];
      delete options?.headers?.['Authorization'];
    }

    const headers = {
      'x-api-key': this._apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
      ...options?.headers,
    };
    if(options.parameters) {
      for(const [key, value] of Object.entries(options.parameters)) {
        url = url.replace(`{${key}}`, value);
      }
    }

    const config: RequestInit = {
      headers,
      method: options.method,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    return fetch(url, config).then(async (response) => {
      if (!response.ok) {
        return Promise.reject(
          await response.json().then((data) => {
            return data;
          })
        );
      }
      return response.json() as Promise<T>;
    });
  }
}
