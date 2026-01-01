import { fetchExplorerFacts } from "./explorer/client";
import type { Chain, ExplorerFacts } from "./explorer/types";

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

type EvidenceEntry = {
  source: string;
  label: string;
  value: string | boolean;
  note?: string;
};

const buildEvidenceNote = (code?: string): string | undefined =>
  code ? `Explorer data unavailable: ${code}` : undefined;

const buildExplorerEvidence = (
  label: string,
  value: string | boolean,
  note?: string
): EvidenceEntry => ({
  source: "explorer",
  label,
  value,
  note,
});

const buildExplorerEvidenceEntries = (
  facts: ExplorerFacts
): {
  contractVerification: EvidenceEntry[];
  ownerPrivileges: EvidenceEntry[];
  holderConcentration: EvidenceEntry[];
} => {
  const sourceNote = buildEvidenceNote(facts.source.error?.code);
  const creationNote = buildEvidenceNote(facts.creation.error?.code);
  const holderNote = buildEvidenceNote(facts.holders.error?.code);

  const contractVerification: EvidenceEntry[] = [
    buildExplorerEvidence(
      "contract source available",
      facts.source.data.sourceAvailable,
      sourceNote
    ),
    buildExplorerEvidence(
      "proxy indicator",
      facts.source.data.isProxy,
      sourceNote
    ),
  ];

  const ownerPrivileges: EvidenceEntry[] = [
    buildExplorerEvidence(
      "creator address",
      facts.creation.data.creatorAddress,
      creationNote
    ),
    buildExplorerEvidence(
      "creation transaction hash",
      facts.creation.data.creationTxHash,
      creationNote
    ),
  ];

  const holderConcentration: EvidenceEntry[] = [
    buildExplorerEvidence(
      "holder list availability",
      facts.holders.data.holderListAvailable,
      holderNote
    ),
  ];

  return { contractVerification, ownerPrivileges, holderConcentration };
};

const buildInspectPayload = (
  chain: string,
  address: string,
  cached: boolean,
  generatedAt: string,
  explorerFacts?: ExplorerFacts
) => {
  const explorerEvidence = explorerFacts
    ? buildExplorerEvidenceEntries(explorerFacts)
    : null;

  return {
    ok: true,
    input: { chain, address },
    result: {
      overall: "unknown",
      summary: [
        "This response is an early foundation; checks remain unknown.",
        "Explorer data is included when available.",
        "No verdict / no investment advice.",
      ],
    },
    checks: [
      {
        id: "contract_verification",
        label: "Contract verification",
        status: "unknown",
        why: "Source availability is fetched but not evaluated in this stage.",
        evidence: explorerEvidence ? explorerEvidence.contractVerification : [],
      },
      {
        id: "owner_privileges",
        label: "Owner / privileges",
        status: "unknown",
        why: "Creator and privilege checks are not analyzed in this stage.",
        evidence: explorerEvidence ? explorerEvidence.ownerPrivileges : [],
      },
      {
        id: "holder_concentration",
        label: "Holder concentration",
        status: "unknown",
        why: "Holder list data is not analyzed in this stage.",
        evidence: explorerEvidence ? explorerEvidence.holderConcentration : [],
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
  };
};

export default {
  async fetch(
    request: Request,
    env?: { ETHERSCAN_API_KEY?: string }
  ): Promise<Response> {
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
        const explorerFacts = await fetchExplorerFacts(
          chain as Chain,
          address,
          env?.ETHERSCAN_API_KEY
        );
        const responseBody = buildInspectPayload(
          chain,
          address,
          false,
          generatedAt,
          explorerFacts
        );
        const response = jsonResponse(responseBody, {
          headers: { "Cache-Control": CACHE_CONTROL },
        });

        const cachedBody = buildInspectPayload(
          chain,
          address,
          true,
          generatedAt,
          explorerFacts
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
