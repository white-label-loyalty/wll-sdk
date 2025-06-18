# Using the SDK

Using the SDK is simple and takes some inspiration from the AWS SDK.

For authentication examples see the [Authentication guide](./02-Authentication.md) this guide will use `StaticAuthProvider` for simplicity.

## Initializing the SDK

```ts
import { WLLRewardsSdk, StaticAuthProvider } from 'wll-rewards-sdk';

const wllSdk = new WLLRewardsSdk({
  apiKey: '<your-api-key>',
  authProvider: new StaticAuthProvider({
    token: '<your-token>',
  }),
  baseUrl: 'https://api.staging.rewards.wlloyalty.net/v1',
});
```

## Using the SDK

The SDK mostly follows the paths of endpoints shown in the [API Docs](https://docs.whitelabel-loyalty.com/rewards.html)

For example: `/rewards` would become `wllSdk.reward.list`

Here is a minimal example of initializing the SDK and fetching a list of rewards.

```ts
import { WLLRewardsSdk, StaticAuthProvider } from 'wll-rewards-sdk';

const wllSdk = new WLLRewardsSdk({
  apiKey: '<your-api-key>',
  authProvider: new StaticAuthProvider({
    token: '<your-token>',
  }),
  baseUrl: 'https://api.staging.rewards.wlloyalty.net/v1',
});

const rewards = await wllSdk.reward.list({});

console.log(rewards); // Output: { data: [...your rewards] }
```

Different endpoints will have different requirements, such as query params, body or headers. Where necessary these _should_ be typed.

## Reference

| Property       | type           | Required? |
| -------------- | -------------- | --------- |
| `apiKey`       | `string`       | Y         |
| `authProvider` | `AuthProvider` | Y         |
| `baseUrl`      | `string`       | Y         |

## Limitations

Currently responses from the SDK are not typed or validated. Please ensure you do appropriate validation if this is needed for your use case.
