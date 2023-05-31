import { setCookie, getCookie, getCookies } from "cookies-next";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { AnyRequest, AnyResponse } from "src/types";

export interface CookieUtil {
  get(key: string): string | undefined;

  set(key: string, value: string, options?: Omit<ResponseCookie, "name" | "value">): void;

  all(): [key: string, value: string][];

  apply(res: NextRequest | NextResponse): void;

  dirty(): boolean;
}

export function cookieUtil(req: AnyRequest, res?: AnyResponse): CookieUtil {
  const cookies: [key: string, value: string, options?: Omit<ResponseCookie, "name" | "value">][] =
    [];

  function get(key: string) {
    if (!("cookies" in req)) {
      return getCookie(key, { req, res } as any) as string;
    } else if (
      "has" in req.cookies &&
      "get" in req.cookies &&
      typeof req.cookies.has === "function" &&
      typeof req.cookies.get === "function"
    ) {
      if (req.cookies.has(key)) return req.cookies.get(key)?.value;
      else return undefined;
    } else return (req.cookies as Record<string, string | undefined>)[key] as string | undefined;
  }

  function set(key: string, value: string, options: Omit<ResponseCookie, "name" | "value"> = {}) {
    cookies.push([key, value, options]);
    if (!res || res instanceof NextResponse) return;
    const { expires, ...other } = options;
    setCookie(key, value, {
      req: req as any,
      res: res as any,
      expires: typeof expires === "number" ? new Date(Date.now() + expires * 1000) : expires,
      ...other,
    });
  }

  function all(): [name: string, value: string][] {
    if (!("cookies" in req))
      return Object.entries(getCookies({ req, res } as any) as Record<string, string>);
    if ("getAll" in req.cookies && typeof req.cookies.getAll === "function")
      return req.cookies.getAll().map(({ name, value }) => [name, value]);
    else return Object.entries(req.cookies);
  }

  function apply(res: NextRequest | NextResponse) {
    for (const [name, value, options] of cookies)
      (res as any).cookies.set({ name, value, ...options });
  }

  function dirty() {
    return !!cookies.length;
  }

  return { get, set, apply, dirty, all };
}
