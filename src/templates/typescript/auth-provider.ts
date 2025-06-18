export enum Region {
  EU = 'eu',
  US = 'us',
}

export abstract class AuthProvider {
  public abstract getToken(region: Region): Promise<string>;
}
