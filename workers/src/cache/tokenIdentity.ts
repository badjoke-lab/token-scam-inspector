import type { Chain } from "../explorer/types";
import type { TokenIdentityResult } from "../providers/tokenIdentityTypes";

const CACHE_TTL_SECONDS = 86400;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL_SECONDS}`;

const buildTokenIdentityCacheKey = (
  origin: string,
  chain: Chain,
  address: string
): Request => {
  const cacheUrl = new URL("/__token__/identity", origin);
  cacheUrl.searchParams.set("chain", chain);
  cacheUrl.searchParams.set("address", address.toLowerCase());
  return new Request(cacheUrl.toString(), { method: "GET" });
};

type TokenIdentityCachePayload = {
  token: TokenIdentityResult;
};

const readTokenIdentityPayload = async (
  response: Response
): Promise<TokenIdentityCachePayload | null> => {
  try {
    return (await response.clone().json()) as TokenIdentityCachePayload;
  } catch (error) {
    return null;
  }
};

const buildCacheResponse = (payload: TokenIdentityCachePayload): Response =>
  new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });

export const getCachedTokenIdentity = async (
  cache: Cache,
  origin: string,
  chain: Chain,
  address: string
): Promise<TokenIdentityResult | null> => {
  const cacheKey = buildTokenIdentityCacheKey(origin, chain, address);
  const cachedResponse = await cache.match(cacheKey);
  if (!cachedResponse) {
    return null;
  }

  const payload = await readTokenIdentityPayload(cachedResponse);
  return payload?.token ?? null;
};

export const putCachedTokenIdentity = async (
  cache: Cache,
  origin: string,
  chain: Chain,
  address: string,
  token: TokenIdentityResult
): Promise<void> => {
  const cacheKey = buildTokenIdentityCacheKey(origin, chain, address);
  const cacheResponse = buildCacheResponse({ token });
  await cache.put(cacheKey, cacheResponse);
};
