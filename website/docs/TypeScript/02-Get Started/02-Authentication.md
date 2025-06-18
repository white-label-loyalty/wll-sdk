# Authentication

In White Label Loyalty services we typically have two authentication methods. "Admin" authentication, which is a WLL issued administrator token and "Tenant"/"Client" authentication which is a token typically issued by yourself to allow end users to authenticate to your loyalty program. For the remainder of this guide **Admin Authentication** will refer to a WLL issued admin token and **Tenant Authentication** will refer to a token issued for an end user to use.

## Admin Authentication

Admin authentication is provided via the `AdminAuthProvider`.

```ts
import { AdminAuthProvider } from "wll-rewards-sdk";
```

### Example

Here is a minimal example of initializing the WLL Rewards SDK with an `AdminAuthProvider`

```ts
import { WLLRewardsSdk, AdminAuthProvider } from "wll-rewards-sdk";

new WLLRewardsSdk({
  apiKey: "<your-api-key>",
  authProvider: new AdminAuthProvider({
    clientId: "<your-client-id>",
    clientSecret: "<your-client-secret>",
  }),
  baseUrl: "https://api.staging.rewards.wlloyalty.net/v1",
});
```

The `AdminAuthProvider` will automatically extract which region you are using from the `baseUrl` and attempt to authenticate.
The current regions supported by the SDK are:

- EU
- US

### AdminAuthConfig Reference

| Property       | type      | Required? |
| -------------- | --------- | --------- |
| `clientId`     | `string`  | Y         |
| `clientSecret` | `string`  | Y         |
| `grantType`    | `string?` | N         |
| `audience`     | `string?` | N         |
| `scope`        | `string?` | N         |

## Tenant Authentication

Tenant authentication is provided via the `StaticAuthProvider`.

```ts
import { StaticAuthProvider } from "wll-rewards-sdk";
```

The `StaticAuthProvider` is a simple implementation of `AuthProvider` that takes a token in its constructor and only returns that token. Essentially just a constant variable of a token. This can be used for tenant authentication after completing your authentication flow, alternatively it can be used for admin authentication if an admin token is stored in the provider.

### Example

Here is a minimal example of initializing the WLL Rewards SDK with a `StaticAuthProvider`

```ts
import { WLLRewardsSdk, StaticAuthProvider } from "wll-rewards-sdk";

async function tenantTokenFlow(): Promise<string> {
  // Your implementation.
}

const token = await tenantTokenFlow();

new WLLRewardsSdk({
  apiKey: "<your-api-key>",
  authProvider: new StaticAuthProvider({
    token,
  }),
  baseUrl: "https://api.staging.rewards.wlloyalty.net/v1",
});
```

### StaticAuthConfig Reference

| Property | type     | Required? |
| -------- | -------- | --------- |
| `token`  | `string` | Y         |

## Implementing Your Own AuthProvider

In some use cases it may be necessary to implement your own AuthProvider in this case the abstract class `AuthProvider` is exported. Implementing this class will allow you to pass it to the SDK. An example use case might be fetching your token from a remote cache.

```ts
abstract class AuthProvider {
  public abstract getToken(region: Region): Promise<string>
}
```

### Example

Here is a minimal example of a custom implemented auth provider.

```ts
import { WLLRewardsSdk, AuthProvider } from "wll-rewards-sdk"
import { fetchRemoteToken } from "../path/to/fetchRemoteToken"

class RemoteAuthProvider implements AuthProvider {
    public async getToken(region: any): Promise<string> {
        const token = await fetchRemoteToken();
        return token;
    }
}

new WLLRewardsSdk({
  apiKey: "<your-api-key>",
  authProvider: new RemoteAuthProvider(),
  baseUrl: "https://api.staging.rewards.wlloyalty.net/v1",
});
```