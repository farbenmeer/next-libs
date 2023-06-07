export function codedError(message: string, code: string, error = Error): Error & { code: string } {
  return Object.assign(new error(message), { code });
}
