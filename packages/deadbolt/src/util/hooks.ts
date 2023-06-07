import { OAuth2Config, OAuth2Plugin, OAuth2PluginHook, OAuth2PluginInit } from "src/types";
import { mapEntries } from "src/util/typed-entries";

export function pluginHooks(
  plugins: (OAuth2Plugin | OAuth2PluginInit)[],
  config: Required<OAuth2Config>,
  reverse: Record<keyof OAuth2Plugin, boolean>,
): Required<OAuth2Plugin> {
  const initialised = plugins.map(it => (typeof it === "function" ? it(config) : it));
  return mapEntries(reverse, ([name, reverse]) => {
    const hooks = initialised
      .map(plugin => plugin[name]?.bind(plugin) as OAuth2PluginHook)
      .filter(it => it);
    if (reverse) hooks.reverse();
    const fn: OAuth2PluginHook = async context => {
      for (const hook of hooks) if ((await hook(context)) === true) return true;
      return false;
    };
    return [name, fn];
  });
}
