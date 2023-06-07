import { NextApiRequest, NextApiResponse } from "next";
import { NextURL } from "next/dist/server/web/next-url";
import { NextRequest, NextResponse } from "next/server";
import { randomState } from "src/plugins";
import {
  OAuth2Props,
  OAuth2FlowContext,
  OAuth2ProviderData,
  OAuth2RequestContext,
  OAuth2ProviderDataMap,
  AnyRequest,
  AnyResponse,
  OAuth2Config,
} from "src/types";
import { cookieUtil, pluginHooks, initConfig, codedError } from "src/util";
import { redirect } from "src/util/redirect";

export function oauth2<Data>({ plugins = [], providers, config: initialConfig }: OAuth2Props) {
  plugins.push(randomState());
  const config = initConfig(initialConfig, providers);
  const hooks = pluginHooks(plugins, config, {
    storeData: false,
    retrieveData: false,
    storeState: false,
    retrieveState: false,
    generateState: false,
    reviveState: true,
  });

  function buildContext(req: AnyRequest, res?: AnyResponse, args?: string[]): OAuth2RequestContext {
    const [provider, step] = args ?? ((req as any).query.args as string[]);
    const { code, state, referer }: Record<string, string> =
      step === "authorize" ? (req as any).query ?? {} : {};
    const realStep = code && state && step === "authorize" ? "exchange" : (step as never);
    const flow: OAuth2FlowContext = { code, state, referer, provider, step: realStep };
    const connected: Record<string, OAuth2ProviderData<unknown>> = {};
    const providerConf = providers.find(it => it.name === flow.provider);
    const cookies = cookieUtil(req, res);
    return { req, res, flow, connected, config, cookies, provider: providerConf };
  }

  async function apiRoute(req: NextApiRequest, res: NextApiResponse) {
    const context = buildContext(req, res);
    const { provider } = context;
    const { baseUrl, defaultProvider = providers[0]?.name } = context.config;
    if (!provider) return res.redirect(`${baseUrl}/${defaultProvider}/authorize`);

    switch (context.flow.step) {
      case "authorize":
        await hooks.generateState(context);
        await hooks.storeState(context);
        await provider.authorize(context);
        break;
      case "exchange":
        {
          await hooks.retrieveState(context);
          // allow proxy redirect process cancellation
          if (await hooks.reviveState(context)) return;
          await provider.exchange(context);
          await provider.loadData?.(context);
          const referer = context.flow.referer ?? "/";
          context.flow.state = context.flow.code = context.flow.referer = undefined;
          await hooks.storeData(context);
          await hooks.storeState(context);
          res.redirect(referer);
        }
        break;
      case "refresh":
        await refreshIfNecessary(context, provider.name);
        break;
      case "logout":
        await hooks.retrieveData(context);
        await provider.revoke?.(context);
        delete context.connected[context.flow.provider];
        await hooks.storeData(context);
        break;
    }
  }

  async function refreshIfNecessary(
    context: OAuth2RequestContext,
    providerName?: string,
    redirectToLoginPage = false,
  ) {
    const currentName = context.flow.provider;
    const currentProvider = context.provider;
    for (const provider of providers.filter(it =>
      providerName ? it.name === providerName : true,
    )) {
      context.flow.provider = provider.name;
      context.provider = provider;
      await hooks.retrieveData(context);
      if (!provider.refresh || !context.connected[provider.name]) continue;
      const data = context.connected[provider.name]!;
      if (data.refreshTokenExpires && data.refreshTokenExpires <= new Date()) return;
      if (data.accessTokenExpires && data.accessTokenExpires <= new Date()) {
        await provider.refresh(context);
        await hooks.storeData(context);
      } else if (!data.accessTokenExpires) {
        try {
          await provider.loadData?.(context);
        } catch {
          await provider.refresh(context);
          await hooks.storeData(context);
        }
      }
    }
    if (redirectToLoginPage && providerName && !context.connected[providerName])
      if (!redirect({ context, url: config.loginPageUrl }))
        throw codedError("Could not redirect to login page", "LOGIN_REDIRECT_FAILED");
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
    await hooks.retrieveData(context);
    if (!context.connected[context.provider.name]?.data) await context.provider.loadData?.(context);
    return context.connected[providerName];
  }

  function authorized<Key extends keyof Data & string>(
    providerName: Key,
    identifier?: string,
    redirectToLoginPage = true,
    onError?: (e: unknown, url: NextURL, config: OAuth2Config) => void,
  ) {
    if (identifier && providerName) providerName = `${providerName}.${identifier}` as any;
    return async (req: NextRequest) => {
      const error = req.nextUrl.clone();
      error.pathname = "/401";
      const context = buildContext(req, undefined, [providerName!, "refresh"]);
      if (!context.provider) return NextResponse.rewrite(error, { status: 401 });
      try {
        await refreshIfNecessary(context, providerName, redirectToLoginPage);
        await context.provider.loadData?.(context);
        if (context.cookies.dirty()) context.cookies.apply(req);
      } catch (e) {
        if (e && typeof e === "object" && "code" in e && e["code"] === "LOGIN_REDIRECT_FAILED")
          return NextResponse.redirect(config.loginPageUrl);
        if (onError) return onError(e, error, config);
        return NextResponse.rewrite(error, { status: 401 });
      }
    };
  }

  return { apiRoute, getData, authorized };
}
