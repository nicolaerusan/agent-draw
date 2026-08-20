import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) return isPrivateIpv4(address);
  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

export async function assertSafeHttpTarget(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid absolute URL");
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Only http:// and https:// targets are supported");
  if (url.username || url.password)
    throw new Error(
      "Credentials must be supplied as headers, not embedded in the URL",
    );
  if (url.hostname === "localhost" || url.hostname.endsWith(".local"))
    throw new Error(
      "Local network targets are blocked by the default runtime policy",
    );

  const addresses = await lookup(url.hostname, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    throw new Error(
      "Private and link-local network targets are blocked by the default runtime policy",
    );
  }
  return url;
}
