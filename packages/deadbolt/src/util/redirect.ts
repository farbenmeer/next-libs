import { buildUrl } from "@farbenmeer/http";
import { OAuth2RequestContext } from "src/types";

export function redirect({
  context,
  url,
  base,
  params,
}: {
  context: OAuth2RequestContext;
  url: URL | string;
  base?: string;
  params?: any;
}) {
  const { res } = context;
  if (!res || !("redirect" in res)) return false;
  res.redirect(buildUrl(url, base, params).toString());
  return true;
}
