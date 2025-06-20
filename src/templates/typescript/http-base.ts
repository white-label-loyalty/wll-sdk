import { AuthProvider, Region } from './auth-provider';

type AllOptional<T> = {
  [K in keyof T]-?: undefined extends T[K] ? true : false;
}[keyof T] extends true
  ? true
  : false;

type OptionalIfAllOptional<T> = AllOptional<T> extends true ? T | undefined : T;

type BaseParams<
  URLParams = undefined,
  QueryParams = undefined,
  HeaderParams = undefined,
  Body = undefined,
> = {} & (undefined extends URLParams
  ? {}
  : {
      [K in keyof URLParams]: URLParams[K];
    }) &
  (undefined extends QueryParams
    ? {}
    : {
        query: QueryParams;
      }) &
  (undefined extends HeaderParams
    ? {}
    : {
        headers: HeaderParams;
      }) &
  (undefined extends Body
    ? {}
    : {
        body: Body;
      });

export type RequestParams<
  URLParams = object,
  QueryParams = undefined,
  HeaderParams = undefined,
  Body = undefined,
> = OptionalIfAllOptional<
  BaseParams<URLParams, QueryParams, HeaderParams, Body>
>;

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
      method: string;
      parameters?: any;
    },
  ): Promise<T> {
    const parameters = options.parameters as
      | RequestParams<
          Record<string, string>,
          Record<string, string>,
          Record<string, string>,
          Record<string, string>
        >
      | undefined;
    const searchParams = new URLSearchParams();
    Object.entries(parameters?.query ?? {}).forEach(([key, value]) => {
      searchParams.set(key, value.toString());
    });

    let url =
      `${this._baseUrl}${endpoint}` +
      (searchParams.size > 0 ? '?' + searchParams.toString() : '');

    const region = this._baseUrl.includes('.us.') ? 'US' : 'EU';
    let authorization = `Bearer ${await this._authProvider.getToken(
      Region[region as keyof typeof Region],
    )}`;

    if (parameters?.headers?.['Authorization']) {
      authorization = options?.parameters.headers['Authorization'];
      delete parameters.headers['Authorization'];
    }

    const headers = {
      'x-api-key': this._apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
      ...options?.parameters?.headers,
    };
    if (parameters) {
      for (const [key, value] of Object.entries(parameters)) {
        if (['query', 'headers', 'body'].includes(key)) continue;

        url = url.replace(`{${key}}`, value as string);
      }
    }

    const config: RequestInit = {
      headers,
      method: options.method,
      body: parameters?.body ? JSON.stringify(parameters.body) : undefined,
    };

    return fetch(url, config).then(async (response) => {
      if (!response.ok) {
        return Promise.reject(
          await response.json().then((data) => {
            return data;
          }),
        );
      }
      return response.json() as Promise<T>;
    });
  }
}
