import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { CookieUtil } from "src/util/cookies";

export type PromiseOr<T> = Promise<T> | T;
export type OAuth2ProviderDataMap<T> = {
  [Key in keyof T]: OAuth2ProviderData<T[Key]>;
};
export type OAuth2PluginHook = (context: OAuth2RequestContext) => PromiseOr<void | boolean>;
export type OAuth2PluginInit = (config: Required<OAuth2Config>) => OAuth2Plugin;

/**
 * saved and optionally persisted data for each provider
 */
export interface OAuth2ProviderData<T> {
  accessToken?: string;
  accessTokenExpires?: Date;
  refreshToken?: string;
  refreshTokenExpires?: Date;
  tokenType?: string;
  data?: T;
}

/**
 * active flow parameters and context
 */
export interface OAuth2FlowContext {
  provider: string;
  step: "authorize" | "exchange" | "refresh" | "logout";
  referer?: string;
  code?: string;
  state?: string;
}

/**
 * Context available to all oauth adapter hooks
 */
export interface OAuth2RequestContext<Data = any> {
  req: NextApiRequest | NextRequest;
  res?: NextApiResponse | NextResponse;
  cookies: CookieUtil;
  provider?: OAuth2Provider;
  config: Required<OAuth2Config>;

  /**
   * Data for each associated or connected account
   */
  connected: OAuth2ProviderDataMap<Data>;

  /**
   * State and context for the current authorization flow
   */
  flow: OAuth2FlowContext;
}

/**
 * hooks and configuration for a general oauth2 plugin
 */
export interface OAuth2Plugin {
  /**
   * persist provider data like tokens or user data
   */
  storeData?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * restore or retrieve persisted data like tokens or user data
   */
  retrieveData?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * state generation for oauth2 (can be used to forward information, should be encrypted)
   * called before {@link #storeState}
   */
  generateState?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * revive state from context (can be used to decrypt information from state parameters)
   * called after {@link #reviveState}
   */
  reviveState?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * persist state (for example in cookies or a database)
   */
  storeState?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * restore state (for example from cookies or a database)
   */
  retrieveState?(context: OAuth2RequestContext): PromiseOr<void | boolean>;
}

/**
 * hooks and configuration for an oauth2 provider
 */
export interface OAuth2Provider {
  name: string;

  /**
   * used to redirect to the provider authorisation endpoint
   */
  authorize(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * used to exchange a code and state for a token pair
   */
  exchange(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * used to refresh an access token if required
   */
  refresh?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * used to revoke access and refresh tokens
   */
  revoke?(context: OAuth2RequestContext): PromiseOr<void | boolean>;

  /**
   * used to load user data
   */
  loadData?(context: OAuth2RequestContext): PromiseOr<void | boolean>;
}

export interface OAuth2Props {
  providers: OAuth2Provider[];
  plugins?: (OAuth2Plugin | OAuth2PluginInit)[];
  config: OAuth2Config;
}

export interface OAuth2Config {
  baseUrl: string;
  secret: string;
  defaultProvider?: string;
  crypto?: Crypto;
  encrypt?(data: string): PromiseOr<string>;
  decrypt?(data: string): PromiseOr<string>;
  // todo: signatures
  // sign?(data: string): PromiseOr<boolean>;
  // verify?(data: string): PromiseOr<string>;
}
