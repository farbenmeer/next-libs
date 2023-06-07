import { HttpClient } from "@farbenmeer/http";
import { OAuth2Provider, OAuth2ProviderData, OAuth2RequestContext, PromiseOr } from "src/types";
import { redirect } from "src/util/redirect";

export interface AzureProviderConfig {
  tenant: string;
  clientId: string;
  clientSecret: string;
  scope?: string;

  loadData?(
    context: OAuth2RequestContext,
    config: { tenant: string } & OAuth2ProviderData<any>,
  ): PromiseOr<any>;
}

export interface AzureTokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  error?: string;
}

const THREE_MONTHS = 7776000000;

export function azureProvider(config: AzureProviderConfig): OAuth2Provider {
  const { clientId, clientSecret, tenant, scope = `${clientId}/.default`, loadData } = config;
  const client = new HttpClient({
    baseUrl: "https://login.microsoftonline.com/",
    contentType: "form",
  });

  return {
    name: `azure.${tenant}`,
    async authorize(context) {
      const { config, flow } = context;
      const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
      const redirectUri = `${config.baseUrl}/azure.${tenant}/authorize`;
      const params = {
        response_type: "code",
        redirect_uri: redirectUri,
        client_id: clientId,
        state: flow.state,
        scope,
      };
      if (redirect({ context, url, params })) return true;
      else return;
    },

    async exchange({ config, flow, connected }) {
      const { state, code } = flow;
      const now = new Date();
      const { data } = await client.post<AzureTokenResponse>(`/${tenant}/oauth2/v2.0/token`, {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${config.baseUrl}/azure.${tenant}/authorize`,
        scope,
        state,
        code,
      });
      if (data.error) throw new Error(data.error);
      connected[`azure.${tenant}`] = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        refreshTokenExpires: data.refresh_token ? new Date(+now + THREE_MONTHS) : undefined,
        tokenType: data.token_type ?? "Bearer",
        accessTokenExpires: new Date(+now + data.expires_in * 1000),
      };
    },

    async loadData(context) {
      if (!loadData) return;
      const config = Object.assign({ tenant }, context.connected[`azure.${tenant}`]);
      context.connected[`azure.${tenant}`].data = await loadData(context, config);
    },

    async revoke(context) {
      const { accessToken, refreshToken } = context.connected[`azure.${tenant}`];
      delete context.connected[`azure.${tenant}`];
      await client.post(`/${tenant}/oauth2/v2.0/token/revoke`, {
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
      });
      await client.post(`/${tenant}/oauth2/v2.0/token/revoke`, {
        client_id: clientId,
        client_secret: clientSecret,
        token: accessToken,
      });
    },

    async refresh(context) {
      const { refreshToken } = context.connected[`azure.${tenant}`];
      const now = new Date();
      const { data } = await client.post<AzureTokenResponse>(`/${tenant}/oauth2/v2.0/token`, {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      Object.assign(context.connected[`azure.${tenant}`], {
        accessToken: data.access_token,
        accessTokenExpires: new Date(+now + data.expires_in * 1000),
      });
    },
  };
}
