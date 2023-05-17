import { OAuth2PluginInit } from "src/types";


export interface StateProxyOptions {
  proxyTo: string;
  allowedOrigins?: (string | RegExp)[];
  allowedProviders?: string[]; // todo: check
}

export function stateProxy(options: StateProxyOptions): OAuth2PluginInit {
  return ({ encrypt, decrypt, baseUrl }) => {
    const { proxyTo, allowedOrigins = [proxyTo, baseUrl], allowedProviders } = options;

    function matchesOrigins(path: string) {
      return !!allowedOrigins.find((it: string | RegExp) => {
        if (typeof it !== "string") return it.test(path);
        else return path.toLowerCase().startsWith(it.toLowerCase());
      });
    }

    function matchesProvider(provider: string) {
      if (!allowedProviders?.length) return true;
      return allowedProviders.includes(provider);
    }

    async function tryParse(state: string) {
      try {
        return JSON.parse(await decrypt(state));
      } catch {
        return undefined;
      }
    }

    return {
      async generateState({ flow }) {
        const path = `${proxyTo}/${flow.provider}/${flow.step}`;
        flow.state = await encrypt(JSON.stringify({ path, referer: flow.referer, provider: flow.provider }));
      },

      async reviveState({ res, flow }) {
        if (!flow.state || !flow.code) return;
        const state = await tryParse(flow.state);
        if (!state || !state.path || !matchesOrigins(state.path) || !matchesProvider(state.provider)) return;
        const url = new URL(state.path);
        const p = url.searchParams;
        p.set("state", flow.state);
        p.set("code", flow.code!);
        if (state.referer || flow.referer) p.set("referer", state.referer ?? flow.referer);
        if (res && "redirect" in res) res.redirect(url.toString());
        return true;
      },
    };
  };
}
