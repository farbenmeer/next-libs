import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import {
  OAuth2Props,
  OAuth2FlowContext,
  OAuth2Plugin,
  OAuth2PluginHook,
  OAuth2ProviderData,
  OAuth2RequestContext,
  OAuth2Config,
  OAuth2ProviderDataMap,
  OAuth2PluginInit,
} from "src/types";
import { cookies } from "src/util/cookies";
import { encryption, getRandomString } from "src/util/encryption";

function initConfig(config: OAuth2Config): Required<OAuth2Config> {
  const copy = { ...config };

  copy.crypto ??= crypto;
  if (!copy.encrypt || !copy.decrypt) {
    const { encrypt, decrypt } = encryption({
      algorithm: "AES-GCM",
      ivLength: 12,
      hash: "SHA-256",
      key: copy.secret,
      crypto: copy.crypto,
    });
    copy.encrypt = encrypt;
    copy.decrypt = decrypt;
  }
  // todo: signatures

  return copy as never;
}

export function oauth2<Data>({ plugins = [], providers, config }: OAuth2Props) {
  plugins.push((({ crypto }) => ({
    generateState(context) {
      context.flow.state = btoa(getRandomString(24, crypto));
    },
  })) as OAuth2PluginInit);
  const initialisedConfig = initConfig(config);
  const initialisedPlugins = plugins.map(it =>
    typeof it === "function" ? it(initialisedConfig) : it,
  );

  function hook<Hook extends keyof OAuth2Plugin>(
    hook: Hook,
    reverse = false,
  ): Required<OAuth2Plugin>[Hook] {
    const hooks = initialisedPlugins
      .map(plugin => plugin[hook]?.bind(plugin) as OAuth2PluginHook)
      .filter(it => it);
    if (reverse) hooks.reverse();
    return async context => {
      for (const hook of hooks) if ((await hook(context)) === true) return true;
      return false;
    };
  }

  const storeData = hook("storeData");
  const retrieveData = hook("retrieveData");
  const storeState = hook("storeState");
  const retrieveState = hook("retrieveState");
  const generateState = hook("generateState");
  const reviveState = hook("reviveState", true);

  function buildContext(
    req: NextApiRequest | NextRequest,
    res?: NextApiResponse | NextResponse,
    args?: string[],
  ): OAuth2RequestContext {
    const [providerName, step] = args ?? ((req as any).query.args as string[]);
    const { code, state, referer }: Record<string, string> =
      step === "authorize" ? (req as any).query ?? {} : {};
    const realStep = code && state && step === "authorize" ? "exchange" : (step as never);
    const flow: OAuth2FlowContext = {
      code,
      state,
      referer,
      provider: providerName,
      step: realStep,
    };
    const connected: Record<string, OAuth2ProviderData<unknown>> = {};
    const provider = providers.find(it => it.name === flow.provider);
    return {
      req,
      res,
      flow,
      connected,
      config: initialisedConfig,
      cookies: cookies(req, res),
      provider,
    };
  }

  async function apiRoute(req: NextApiRequest, res: NextApiResponse) {
    const context = buildContext(req, res);
    const { provider } = context;
    const { baseUrl, defaultProvider = providers[0]?.name } = context.config;
    if (!provider) return res.redirect(`${baseUrl}/${defaultProvider}/authorize`);

    switch (context.flow.step) {
      case "authorize":
        await generateState(context);
        await storeState(context);
        await provider.authorize(context);
        break;
      case "exchange":
        {
          await retrieveState(context);
          // allow proxy redirect process cancellation
          if (await reviveState(context)) return;
          await provider.exchange(context);
          await provider.loadData?.(context);
          const referer = context.flow.referer ?? "/";
          context.flow.state = context.flow.code = context.flow.referer = undefined;
          await storeData(context);
          await storeState(context);
          res.redirect(referer);
        }
        break;
      case "refresh":
        await refreshIfNecessary(context, provider.name);
        break;
      case "logout":
        await retrieveData(context);
        await provider.revoke?.(context);
        delete context.connected[context.flow.provider];
        await storeData(context);
        break;
    }
  }

  async function refreshIfNecessary(context: OAuth2RequestContext, providerName?: string) {
    const currentName = context.flow.provider;
    const currentProvider = context.provider;
    for (const provider of providers.filter(it =>
      providerName ? it.name === providerName : true,
    )) {
      context.flow.provider = provider.name;
      context.provider = provider;
      await retrieveData(context);
      if (!provider.refresh || !context.connected[provider.name]) continue;
      const data = context.connected[provider.name]!;
      if (data.refreshTokenExpires && data.refreshTokenExpires <= new Date()) return;
      if (data.accessTokenExpires && data.accessTokenExpires <= new Date()) {
        await provider.refresh(context);
        await storeData(context);
      } else if (!data.accessTokenExpires) {
        try {
          await provider.loadData?.(context);
        } catch {
          await provider.refresh(context);
          await storeData(context);
        }
      }
    }
    context.flow.provider = currentName;
    context.provider = currentProvider;
  }

  async function getData<Key extends keyof Data & string>(
    req: NextApiRequest | NextRequest,
    res: NextApiResponse | NextResponse,
    providerName: Key,
    identifier?: string,
  ): Promise<OAuth2ProviderDataMap<Data>[Key] | undefined> {
    if (identifier) providerName = `${providerName}.${identifier}` as any;
    const context = buildContext(req, res, [providerName, "refresh"]);
    await refreshIfNecessary(context);
    if (!context.provider) return undefined;
    await retrieveData(context);
    if (!context.connected[context.provider.name].data) await context.provider.loadData?.(context);
    return context.connected[providerName];
  }

  function authorized<Key extends keyof Data & string>(providerName: Key, identifier?: string) {
    if (identifier && providerName) providerName = `${providerName}.${identifier}` as any;
    return async (req: NextRequest) => {
      const error = req.nextUrl.clone();
      error.pathname = "/401";
      const context = buildContext(req, undefined, [providerName!, "refresh"]);
      if (!context.provider) return NextResponse.rewrite(error, { status: 401 });
      try {
        await refreshIfNecessary(context, providerName);
        await context.provider.loadData?.(context);
        if (context.cookies.dirty()) context.cookies.apply(req);
      } catch (e) {
        return NextResponse.rewrite(error, { status: 401 });
      }
    };
  }

  return { apiRoute, getData, authorized };
}
