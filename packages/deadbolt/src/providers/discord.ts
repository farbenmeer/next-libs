import { buildUrl, HttpClient } from "@farbenmeer/http";
import { OAuth2Provider } from "src/types";

export interface DiscordProviderConfig {
  clientId: string;
  clientSecret: string;
  scope: string;
}

interface DiscordTokenResponse {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  error?: string;
}

export function discordProvider(config: DiscordProviderConfig): OAuth2Provider {
  const { clientId, clientSecret, scope } = config;
  const client = new HttpClient({
    baseUrl: "https://discordapp.com",
    contentType: "form",
  });

  return {
    name: "discord",
    async authorize({ config, res, flow }) {
      const redirectUri = `${config.baseUrl}/discord/authorize`;
      if (!res || !("redirect" in res)) return;
      res.redirect(
        buildUrl("https://discordapp.com/api/oauth2/authorize", undefined, {
          response_type: "code",
          redirect_uri: redirectUri,
          client_id: clientId,
          state: flow.state,
          scope,
        }).toString(),
      );
      return true;
    },

    async exchange({ config, flow, connected }) {
      const { state, code } = flow;
      const now = new Date();
      const { data } = await client.post<DiscordTokenResponse>("/api/oauth2/token", {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${config.baseUrl}/discord/authorize`,
        scope,
        state,
        code,
      });
      if (data.error) throw new Error(data.error);
      connected.discord = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        accessTokenExpires: new Date(+now + data.expires_in * 1000),
      };
    },

    async loadData(context) {
      const { tokenType, accessToken } = context.connected.discord;
      const { data } = await client.get<any>("/api/users/@me", {
        headers: { authorization: `${tokenType ?? "Bearer"} ${accessToken}` },
      });
      if (data.error) throw new Error(data.error);
      context.connected.discord.data = {
        ...data,
        avatarUrl: `//cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`,
      };
    },

    async revoke(context) {
      const { accessToken, refreshToken } = context.connected.discord;
      delete context.connected.discord;
      await client.post("/api/oauth2/token/revoke", {
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
      });
      await client.post("/api/oauth2/token/revoke", {
        client_id: clientId,
        client_secret: clientSecret,
        token: accessToken,
      });
    },

    async refresh(context) {
      const { refreshToken } = context.connected.discord;
      const now = new Date();
      const { data } = await client.post<DiscordTokenResponse>("/api/oauth2/token", {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      Object.assign(context.connected.discord, {
        accessToken: data.access_token,
        accessTokenExpires: new Date(+now + data.expires_in * 1000),
      });
    },
  };
}
