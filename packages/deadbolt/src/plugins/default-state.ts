import { OAuth2PluginInit } from "src/types";
import { getRandomString } from "src/util";

export function randomState(length = 24): OAuth2PluginInit {
  return ({ crypto }) => ({
    generateState(context) {
      context.flow.state = btoa(getRandomString(length, crypto));
    },
  });
}
