/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  oauth2,
  cookieStorage,
  externalStorage,
  stateProxy,
  azureProvider,
  discordProvider,
} from "src";

// use getData in handlers to get access to tokens and user data
// use authorized as a middleware

export const { apiRoute, getData, authorized } = oauth2<{
  discord: any;
  azure: any;
}>({
  config: {
    crypto,
    secret:
      "309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f",
    baseUrl: "https://www.myproductionhost.com/api/auth",
    defaultProvider: "discord",
  },
  providers: [
    discordProvider({
      clientId: "id here",
      clientSecret: "secret here",
      scope: "identify",
    }),
    azureProvider({
      clientId: "id here",
      clientSecret: "secret here",
      tenant: "tenant id here",
    }),
  ],
  plugins: [
    stateProxy({
      proxyTo: "http://localhost:3000/api/auth",
      allowedOrigins: ["http://localhost:3000", "https://www.myproductionhost.com/api/auth"],
      allowedProviders: ["discord", "azure.tenant-id-here"],
    }),
    cookieStorage(),
    externalStorage({
      setState(key, context) {
        // do something with key and context
      },
      setData(key, context) {
        // do something with key and context
      },
    }),
  ],
});

export default apiRoute;
