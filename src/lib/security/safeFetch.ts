import { promises as dns } from "node:dns";
import net from "node:net";

// Shared SSRF-safe URL fetching — anywhere the app fetches a URL a member typed in (website
// import, social profile comparison) needs this, since without it a member could point the
// server at its own internal network (including the 169.254.169.254 cloud metadata endpoint)
// just by entering an address instead of a real external site. See src/lib/website.ts and
// src/lib/social.ts for the two current callers.

export class UnsafeUrlError extends Error {}

const UNREACHABLE_MESSAGE = "That address isn't reachable.";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_REDIRECTS = 5;

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local / cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true; // link-local / unique-local
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
    }
    return false;
  }
  return true; // couldn't parse — treat as unsafe rather than silently allow it through
}

// Resolves the hostname and rejects anything pointing at a private, loopback, or link-local
// address. Exported so callers can re-check a redirect's or an extracted image URL's host
// before following it, not just the original address.
export async function assertPublicHost(hostname: string): Promise<void> {
  if (hostname === "localhost") throw new UnsafeUrlError(UNREACHABLE_MESSAGE);
  let records: { address: string }[];
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("Couldn't resolve that address — double-check it and try again.");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new UnsafeUrlError(UNREACHABLE_MESSAGE);
  }
}

export function toHttpUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) throw new UnsafeUrlError("Enter a web address first.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new UnsafeUrlError(`"${input}" doesn't look like a valid web address.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only http/https addresses are supported.");
  }
  return url;
}

// Fetches a URL with the private-IP guard re-checked on every redirect hop (fetch's built-in
// `redirect: "follow"` would only ever check the original address, letting a public URL that
// 302s to an internal one slip the guard entirely) — so every caller gets the same protection
// without re-implementing this loop.
export async function fetchPublicUrl(
  rawUrl: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let url = toHttpUrl(rawUrl);

  for (let redirects = 0; ; redirects++) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new UnsafeUrlError("That address took too long to respond.");
      }
      throw new UnsafeUrlError("Couldn't reach that address — double-check it and try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (redirects >= maxRedirects) {
        throw new UnsafeUrlError("That address redirected too many times.");
      }
      url = new URL(res.headers.get("location")!, url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new UnsafeUrlError(UNREACHABLE_MESSAGE);
      }
      continue;
    }

    return res;
  }
}
