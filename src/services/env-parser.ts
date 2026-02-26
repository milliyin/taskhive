// Service: Parse .env files and encrypt/decrypt env vars

import { encrypt, decrypt } from "@/lib/encryption";

/** Parse .env file content into key-value pairs */
export function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

/** Encrypt env vars object to a single string for DB storage */
export function encryptEnvVars(vars: Record<string, string>): string {
  return encrypt(JSON.stringify(vars));
}

/** Decrypt stored env vars string back to object */
export function decryptEnvVars(encrypted: string): Record<string, string> {
  return JSON.parse(decrypt(encrypted));
}
