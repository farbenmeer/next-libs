import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { OAuth2PluginInit, OAuth2ProviderData } from "src/types";
import { codedError } from "src/util/error";

export interface CookieStorageOptions {
  name?: string;
  cookie?: Omit<ResponseCookie, "name" | "value">;
  saveData?: boolean;
}

export function cookieStorage({
  name = "oauth2",
  cookie,
  saveData = true,
}: CookieStorageOptions = {}): OAuth2PluginInit {
  function cookieLengthCheck(max = 4096) {
    let length = 0;
    return function (addition: string) {
      if ((length += addition.length) > max)
        throw codedError(
          "Cookie length exceeds 4096 bytes, consider using externalStorage instead",
          "COOKIE_TOO_LONG",
        );
      return addition;
    };
  }

  return ({ encrypt, decrypt }) => ({
    async storeState({ flow, cookies }) {
      const { state, referer, provider } = flow;
      const value = JSON.stringify({ state, referer, provider });
      const check = cookieLengthCheck();
      if (!state) cookies.set(`${name}.state`, "");
      else cookies.set(`${name}.state`, check(await encrypt(value)), cookie);
    },

    async retrieveState(context) {
      if (!context.cookies.get(`${name}.state`)) return;
      const value = context.cookies.get(`${name}.state`)!;
      try {
        const state = JSON.parse(await decrypt(value));
        for (const key of ["state", "code", "referer"] as const)
          if (state[key] !== undefined && context.flow[key] == null) context.flow[key] = state[key];
      } catch {
        /* ignore */
      }
    },

    async storeData({ connected, cookies }) {
      if (!saveData) return;
      const check = cookieLengthCheck();
      for (const [provider, data] of Object.entries(connected)) {
        if (!data) continue;
        const { data: _, ...state } = data;
        const encrypted = await encrypt(JSON.stringify(state));
        cookies.set(`${name}.data.${provider}`, check(encrypted), {
          expires: state.refreshTokenExpires,
          ...cookie,
        });
      }
    },

    async retrieveData({ cookies, connected }) {
      if (!saveData) return;
      for (const [key, value] of cookies.all()) {
        if (!key.startsWith(`${name}.data.`) || !value) continue;
        const provider = key.slice(`${name}.data.`.length);
        try {
          const { tokenType, accessToken, accessTokenExpires, refreshToken, refreshTokenExpires } =
            JSON.parse(await decrypt(value)) as OAuth2ProviderData<any>;
          Object.assign((connected[provider] ??= {}), {
            tokenType,
            accessToken,
            accessTokenExpires: accessTokenExpires && new Date(accessTokenExpires),
            refreshToken,
            refreshTokenExpires: refreshTokenExpires && new Date(refreshTokenExpires),
          });
        } catch (e) {
          /* ignore */
        }
      }
    },
  });
}
