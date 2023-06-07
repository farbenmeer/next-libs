import { OAuth2Config, OAuth2Provider } from "src/types";
import { encryption } from "src/util/encryption";

export function initConfig(
  config: OAuth2Config,
  providers: OAuth2Provider[],
): Required<OAuth2Config> {
  const defaultProvider = config.defaultProvider ?? providers[0]?.name;
  const copy = { defaultProvider, crypto, ...config };

  if (!copy.encrypt || !copy.decrypt) {
    const { encrypt, decrypt } = encryption({
      algorithm: "AES-GCM",
      ivLength: 12,
      hash: "SHA-256",
      key: copy.secret,
      crypto: copy.crypto,
    });
    Object.assign(copy, { encrypt, decrypt });
  }

  if (!copy.loginPageUrl) copy.loginPageUrl = `${copy.baseUrl}/${defaultProvider}/authorize`;

  // todo: signatures

  return copy as never;
}
