/**
 * Browsers only expose `crypto.randomUUID` in secure contexts (HTTPS/localhost).
 * Provide a deterministic fallback for HTTP deployments.
 */
export function createUuid(): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `uuid-${Date.now()}-${randomPart}`;
}
