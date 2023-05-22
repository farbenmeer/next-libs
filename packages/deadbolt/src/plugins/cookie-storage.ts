import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  OAuth2FlowContext,
  OAuth2Plugin,
  OAuth2PluginInit,
  OAuth2ProviderData,
  OAuth2ProviderDataMap,
  OAuth2RequestContext,
  PromiseOr,
} from "src/types";
import { getRandomString } from "src/util/encryption";

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
  return ({ encrypt, decrypt }) => ({
    async storeState({ flow, cookies }) {
      const { state, referer, provider } = flow;
      const value = JSON.stringify({ state, referer, provider });
      if (!state) cookies.set(`${name}.state`, "");
      else cookies.set(`${name}.state`, (await encrypt(value)) as string, cookie);
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
      for (const [provider, data] of Object.entries(connected)) {
        if (!data) continue;
        const { data: _, ...state } = data;
        cookies.set(`${name}.data.${provider}`, await encrypt(JSON.stringify(state)), {
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

export interface ExternalStorageOptions {
  name?: string;
  cookie?: Omit<ResponseCookie, "name" | "value">;
  createKey?(context: OAuth2RequestContext): PromiseOr<string>;
  getState?(
    key: string,
    context: OAuth2RequestContext,
  ): PromiseOr<Partial<OAuth2FlowContext> | undefined>;
  setState?(key: string, context: OAuth2RequestContext): PromiseOr<void>;
  getData?(
    key: string,
    context: OAuth2RequestContext,
  ): PromiseOr<Partial<OAuth2ProviderDataMap<any>>>;
  setData?(key: string, context: OAuth2RequestContext): PromiseOr<void>;
}

export function externalStorage({
  name = "oauth2.external",
  cookie,
  createKey = ({ config }) => btoa(getRandomString(24, config.crypto)),
  getState,
  setState,
  getData,
  setData,
}: ExternalStorageOptions): OAuth2Plugin {
  const config: Omit<ResponseCookie, "name" | "value"> = {
    expires: new Date("9999-12-31T23:59:59.999Z"),
    ...cookie,
  };

  return {
    async storeState(context) {
      if (!setState) return;
      if (typeof context.cookies.get(name) === "string")
        return setState(context.cookies.get(name)!, context);
      const key = await createKey(context);
      context.cookies.set(name, key, config);
      return setState(key, context);
    },

    async retrieveState(context) {
      if (!getState) return;
      if (typeof context.cookies.get(name) !== "string") return;
      const state = await getState(context.cookies.get(name)!, context);
      if (!state) return;
      for (const key of ["state", "code", "referer"] as const)
        if (state[key] !== undefined) context.flow[key] = state[key];
    },

    async storeData(context) {
      if (!setData) return;
      if (typeof context.cookies.get(name) === "string")
        return setData(context.cookies.get(name)!, context);
      const key = await createKey(context);
      context.cookies.set(name, key, config);
      return setData(key, context);
    },

    async retrieveData(context) {
      if (!getData) return;
      if (typeof context.cookies.get(name) !== "string") return;
      const connected = await getData(context.cookies.get(name)!, context);
      if (!connected) return;
      for (const [provider, data] of Object.entries(connected))
        Object.assign((context.connected[provider] ??= {}), data);
    },
  };
}
