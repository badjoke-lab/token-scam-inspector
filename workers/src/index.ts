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

type SellRestrictionCheck = {
  id: "sell_restriction";
  label: "Sell Restriction / Honeypot";
  result: "ok" | "warn" | "high" | "unknown";
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type OwnerPrivilegesCheck = {
  id: "owner_privileges";
  label: "Owner Privileges";
  result: "ok" | "warn" | "high" | "unknown";
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
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

const SELL_RESTRICTION_SHORT = "You may not be able to sell this token.";
const SELL_RESTRICTION_DETAIL =
  "Buying is allowed but selling may be blocked or heavily taxed.";
const SELL_RESTRICTION_VERIFY_STEPS = [
  "Check explorer verified source and look for transfer restrictions.",
  "Try a tiny swap on a trusted tool.",
];

const OWNER_PRIVILEGES_SHORT = "The owner may change critical rules.";
const OWNER_PRIVILEGES_DETAIL =
  "Owner-controlled parameters can turn a token into a trap later.";
const OWNER_PRIVILEGES_VERIFY_STEPS = [
  "Review verified source on the explorer for owner-only functions.",
];

const SELL_RESTRICTION_HIGH_PATTERNS = [
  "blacklist",
  "isBlacklisted",
  "whitelist",
  "onlyWhitelisted",
  "tradingEnabled",
  "enableTrading",
  "tradingOpen",
  "whenTradingEnabled",
];

const SELL_RESTRICTION_WARN_PATTERNS = [
  "antiBot",
  "cooldown",
  "transferDelay",
  "maxSell",
  "sellLimit",
  "sellTax",
];

const OWNER_PRIVILEGES_OWNER_PATTERNS = [
  "owner",
  "onlyOwner",
  "transferOwnership",
  "renounceOwnership",
  "ownable",
];

const OWNER_PRIVILEGES_HIGH_PATTERNS = ["blacklist", "whitelist"];

const OWNER_PRIVILEGES_WARN_PATTERNS = [
  "setFee",
  "setTax",
  "setMaxTx",
  "setMaxWallet",
  "setLimits",
  "setLimit",
  "enableTrading",
  "tradingEnabled",
];

const buildSellRestrictionEvidence = (
  matches: string[],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  if (matches.length > 0) {
    return matches.map((match) => `Found "${match}" pattern.`);
  }

  return [
    `Scanned for patterns: ${[
      ...SELL_RESTRICTION_HIGH_PATTERNS,
      ...SELL_RESTRICTION_WARN_PATTERNS,
    ].join(", ")}.`,
  ];
};

const buildOwnerPrivilegesEvidence = (
  ownerMatches: string[],
  changeMatches: string[],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  if (ownerMatches.length > 0 || changeMatches.length > 0) {
    return [
      ...ownerMatches.map((match) => `Found owner pattern: "${match}".`),
      ...changeMatches.map((match) => `Found rule-change pattern: "${match}".`),
    ];
  }

  return [
    `Scanned for owner patterns: ${OWNER_PRIVILEGES_OWNER_PATTERNS.join(", ")}.`,
    `Scanned for rule-change patterns: ${[
      ...OWNER_PRIVILEGES_HIGH_PATTERNS,
      ...OWNER_PRIVILEGES_WARN_PATTERNS,
    ].join(", ")}.`,
  ];
};

const buildSellRestrictionCheck = (
  explorerFacts?: ExplorerFacts
): SellRestrictionCheck => {
  const sourceFacts = explorerFacts?.source;
  const sourceStatus = sourceFacts?.data.sourceAvailable;
  const sourceCode = sourceFacts?.data.sourceCode ?? "";

  if (sourceStatus !== true || sourceCode.trim() === "") {
    const reason =
      sourceFacts?.error?.code ??
      (sourceStatus === false ? "source_unavailable" : "source_unavailable");
    return {
      id: "sell_restriction",
      label: "Sell Restriction / Honeypot",
      result: "unknown",
      short: SELL_RESTRICTION_SHORT,
      detail: SELL_RESTRICTION_DETAIL,
      evidence: buildSellRestrictionEvidence([], reason),
      howToVerify: SELL_RESTRICTION_VERIFY_STEPS,
    };
  }

  const sourceLower = sourceCode.toLowerCase();
  const highMatches = SELL_RESTRICTION_HIGH_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const warnMatches = SELL_RESTRICTION_WARN_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const matches = [...highMatches, ...warnMatches];

  let result: SellRestrictionCheck["result"] = "ok";
  if (highMatches.length > 0) {
    result = "high";
  } else if (warnMatches.length > 0) {
    result = "warn";
  }

  return {
    id: "sell_restriction",
    label: "Sell Restriction / Honeypot",
    result,
    short: SELL_RESTRICTION_SHORT,
    detail: SELL_RESTRICTION_DETAIL,
    evidence: buildSellRestrictionEvidence(matches),
    howToVerify: SELL_RESTRICTION_VERIFY_STEPS,
  };
};

const buildOwnerPrivilegesCheck = (
  explorerFacts?: ExplorerFacts
): OwnerPrivilegesCheck => {
  const sourceFacts = explorerFacts?.source;
  const sourceStatus = sourceFacts?.data.sourceAvailable;
  const sourceCode = sourceFacts?.data.sourceCode ?? "";

  if (sourceStatus !== true || sourceCode.trim() === "") {
    const reason =
      sourceFacts?.error?.code ??
      (sourceStatus === false ? "source_unavailable" : "source_unavailable");
    return {
      id: "owner_privileges",
      label: "Owner Privileges",
      result: "unknown",
      short: OWNER_PRIVILEGES_SHORT,
      detail: OWNER_PRIVILEGES_DETAIL,
      evidence: buildOwnerPrivilegesEvidence([], [], reason),
      howToVerify: OWNER_PRIVILEGES_VERIFY_STEPS,
    };
  }

  const sourceLower = sourceCode.toLowerCase();
  const ownerMatches = OWNER_PRIVILEGES_OWNER_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const changeHighMatches = OWNER_PRIVILEGES_HIGH_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const changeWarnMatches = OWNER_PRIVILEGES_WARN_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const changeMatches = [...changeHighMatches, ...changeWarnMatches];

  let result: OwnerPrivilegesCheck["result"] = "ok";
  if (ownerMatches.length > 0 && changeHighMatches.length > 0) {
    result = "high";
  } else if (ownerMatches.length > 0 && changeWarnMatches.length > 0) {
    result = "warn";
  }

  return {
    id: "owner_privileges",
    label: "Owner Privileges",
    result,
    short: OWNER_PRIVILEGES_SHORT,
    detail: OWNER_PRIVILEGES_DETAIL,
    evidence: buildOwnerPrivilegesEvidence(ownerMatches, changeMatches),
    howToVerify: OWNER_PRIVILEGES_VERIFY_STEPS,
  };
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
      buildSellRestrictionCheck(explorerFacts ?? undefined),
      buildOwnerPrivilegesCheck(explorerFacts ?? undefined),
      {
        id: "contract_verification",
        label: "Contract verification",
        status: "unknown",
        why: "Source availability is fetched but not evaluated in this stage.",
        evidence: explorerEvidence ? explorerEvidence.contractVerification : [],
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
