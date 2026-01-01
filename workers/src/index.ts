const jsonResponse = (body: unknown, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

const errorResponse = (message: string, status = 400): Response =>
  jsonResponse(
    {
      ok: false,
      error: { code: "bad_request", message },
      meta: { generatedAt: new Date().toISOString(), cached: false },
    },
    { status }
  );

const isValidAddress = (address: string): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(address);

const CACHE_TTL_SECONDS = 86400;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL_SECONDS}`;

const buildInspectPayload = (
  chain: string,
  address: string,
  cached: boolean,
  generatedAt: string
) => ({
  ok: true,
  input: { chain, address },
  result: {
    overall: "unknown",
    summary: [
      "This is a dummy response (no real inspection yet).",
      "It shows the output format only.",
      "No verdict / no investment advice.",
    ],
  },
  checks: [
    {
      id: "dummy_sources",
      label: "Data sources",
      status: "unknown",
      why: "External data sources are not connected in this stage.",
      evidence: [],
    },
    {
      id: "dummy_format",
      label: "Output format",
      status: "ok",
      why: "The endpoint returns explainable JSON with neutral language.",
      evidence: [],
    },
  ],
  meta: { generatedAt, cached },
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/hello") {
      return jsonResponse({ ok: true, message: "hello" });
    }

    if (request.method === "GET" && url.pathname === "/api/inspect") {
      const chain = url.searchParams.get("chain");
      const address = url.searchParams.get("address");

      if (!chain || !address) {
        return errorResponse(
          "Missing required query parameters: chain and address."
        );
      }

      if (!isValidAddress(address)) {
        return errorResponse("Invalid address format.");
      }

      const cacheKeyUrl = new URL("/api/inspect", url.origin);
      cacheKeyUrl.searchParams.set("chain", chain);
      cacheKeyUrl.searchParams.set("address", address);
      const cacheKey = new Request(cacheKeyUrl.toString(), {
        method: "GET",
      });
      const cache = caches.default;

      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const generatedAt = new Date().toISOString();
        const responseBody = buildInspectPayload(
          chain,
          address,
          false,
          generatedAt
        );
        const response = jsonResponse(responseBody, {
          headers: { "Cache-Control": CACHE_CONTROL },
        });

        const cachedBody = buildInspectPayload(
          chain,
          address,
          true,
          generatedAt
        );
        const cacheResponse = jsonResponse(cachedBody, {
          headers: { "Cache-Control": CACHE_CONTROL },
        });

        await cache.put(cacheKey, cacheResponse.clone());
        return response;
      } catch (error) {
        cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
        return errorResponse("Unexpected error while generating response.", 500);
      }
    }

    return jsonResponse(
      { ok: false, error: { code: "not_found", message: "Not found" } },
      { status: 404 }
    );
  },
};
