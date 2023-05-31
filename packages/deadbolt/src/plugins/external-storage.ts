import { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import {
  OAuth2FlowContext,
  OAuth2Plugin,
  OAuth2ProviderDataMap,
  OAuth2RequestContext,
  PromiseOr,
} from "src/types";
import { getRandomString } from "src/util";

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
