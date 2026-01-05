import { fetchExplorerFacts } from "./explorer/client";
import type {
  Chain,
  ExplorerErrorCode,
  ExplorerFacts,
  ExplorerValue,
} from "./explorer/types";

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
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = (response: Response): Response => {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

type CheckResult = "ok" | "warn" | "high" | "unknown";
type OverallRisk = "low" | "medium" | "high" | "unknown";

type SellRestrictionCheck = {
  id: "sell_restriction";
  label: "Sell Restriction / Honeypot";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type OwnerPrivilegesCheck = {
  id: "owner_privileges";
  label: "Owner Privileges";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type MintCapabilityCheck = {
  id: "mint_capability";
  label: "Mint Capability";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type LiquidityLockCheck = {
  id: "liquidity_lock";
  label: "Liquidity Lock Status";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type HolderConcentrationCheck = {
  id: "holder_concentration";
  label: "Holder Concentration";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type ContractVerificationCheck = {
  id: "contract_verification";
  label: "Contract Verification";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type TradingEnableControlCheck = {
  id: "trading_enable_control";
  label: "Trading Enable Control";
  result: CheckResult;
  short: string;
  detail: string;
  evidence: string[];
  howToVerify: string[];
};

type CheckWithResult = {
  result: CheckResult;
  short: string;
};

const CHECK_RESULTS = new Set<CheckResult>([
  "ok",
  "warn",
  "high",
  "unknown",
]);

const isCheckWithResult = (check: unknown): check is CheckWithResult => {
  if (!check || typeof check !== "object") {
    return false;
  }

  const maybeCheck = check as { result?: unknown; short?: unknown };
  return (
    typeof maybeCheck.short === "string" &&
    typeof maybeCheck.result === "string" &&
    CHECK_RESULTS.has(maybeCheck.result as CheckResult)
  );
};

const buildOverallRisk = (checks: unknown[]): OverallRisk => {
  let highCount = 0;
  let warnCount = 0;
  let okCount = 0;
  let unknownCount = 0;

  for (const check of checks) {
    if (!isCheckWithResult(check)) {
      continue;
    }

    switch (check.result) {
      case "high":
        highCount += 1;
        break;
      case "warn":
        warnCount += 1;
        break;
      case "ok":
        okCount += 1;
        break;
      case "unknown":
        unknownCount += 1;
        break;
      default:
        break;
    }
  }

  if (highCount >= 1) {
    return "high";
  }

  if (warnCount >= 1) {
    return "medium";
  }

  if (okCount >= 1 && unknownCount === 0) {
    return "low";
  }

  if (highCount === 0 && warnCount === 0 && unknownCount >= 1) {
    return "unknown";
  }

  return "unknown";
};

const buildSummary = (overallRisk: OverallRisk): string => {
  switch (overallRisk) {
    case "high":
      return "High: Some risk indicators were detected.";
    case "medium":
      return "Medium: Some risk indicators were detected.";
    case "low":
      return "Low: No strong risk indicators were detected in these checks.";
    case "unknown":
    default:
      return "Unknown: Insufficient data to confirm key signals.";
  }
};

const buildTopReasons = (checks: unknown[]): string[] => {
  const reasons: string[] = [];

  for (const check of checks) {
    if (reasons.length >= 3) {
      break;
    }

    if (isCheckWithResult(check) && check.result === "high") {
      reasons.push(check.short);
    }
  }

  for (const check of checks) {
    if (reasons.length >= 3) {
      break;
    }

    if (isCheckWithResult(check) && check.result === "warn") {
      reasons.push(check.short);
    }
  }

  return reasons.slice(0, 3);
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

const MINT_CAPABILITY_SHORT = "Token supply might increase later.";
const MINT_CAPABILITY_DETAIL = "Unlimited minting can crash price.";
const MINT_CAPABILITY_VERIFY_STEPS = [
  "Review verified source or ABI for mint-related functions and permissions.",
];

const LIQUIDITY_LOCK_SHORT = "Liquidity might be removable.";
const LIQUIDITY_LOCK_DETAIL =
  "Removing liquidity makes selling impossible. Phase 1 data sources cannot confirm LP lock status.";
const LIQUIDITY_LOCK_VERIFY_STEPS = [
  "Check the LP token holder on the DEX pair and see if it is locked or burned.",
  "Look for a reputable locker (Team Finance, Unicrypt, etc.) and verify the lock transaction.",
  "If liquidity is burned, verify LP tokens are sent to a dead address.",
];

const HOLDER_CONCENTRATION_SHORT = "A few wallets may control most tokens.";
const HOLDER_CONCENTRATION_DETAIL = "Large holders can dump and crash price.";
const HOLDER_CONCENTRATION_VERIFY_STEPS = [
  "Open the token holders page on the explorer and check Top holders distribution.",
  "Compare Top 1/5/10 share and watch for unusually high concentration.",
];

const CONTRACT_VERIFICATION_SHORT = "Contract code may be hidden.";
const CONTRACT_VERIFICATION_DETAIL = "Unverified code hides malicious logic.";
const CONTRACT_VERIFICATION_VERIFY_STEPS = [
  "Open the explorer page and check whether the contract is verified.",
];

const TRADING_ENABLE_CONTROL_SHORT = "Trading might be paused or restricted.";
const TRADING_ENABLE_CONTROL_DETAIL =
  "Trading can be stopped after users buy.";
const TRADING_ENABLE_CONTROL_VERIFY_STEPS = [
  "Open the explorer verified source or ABI, then search for pause/trading toggle functions.",
  "Review any pause/tradingEnabled functions and who can call them.",
];

const EXPLORER_ADDRESS_BASE: Record<Chain, string> = {
  eth: "https://etherscan.io/address/",
  bsc: "https://bscscan.com/address/",
};

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

const MINT_CAPABILITY_MINT_PATTERNS = [
  "mint",
  "_mint",
  "mintto",
  "mint(address",
  "increaseSupply",
];

const MINT_CAPABILITY_ROLE_PATTERNS = [
  "minter_role",
  "onlyminter",
  "setminter",
  "addminter",
];

const TRADING_ENABLE_CONTROL_HIGH_PATTERNS = [
  "pause",
  "paused",
  "unpause",
  "disableTrading",
  "stopTrading",
  "resumeTrading",
];

const TRADING_ENABLE_CONTROL_WARN_PATTERNS = [
  "tradingEnabled",
  "enableTrading",
  "setTrading",
  "openTrading",
  "tradingActive",
];

const buildExplorerAddressUrl = (
  chain: string,
  address: string
): string | null => {
  const normalizedChain = chain.toLowerCase() as Chain;
  const baseUrl = EXPLORER_ADDRESS_BASE[normalizedChain];
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}${address}#code`;
};

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

const buildMintCapabilityEvidence = (
  mintMatches: string[],
  roleMatches: string[],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  if (mintMatches.length > 0 || roleMatches.length > 0) {
    return [
      ...mintMatches.map((match) => `Found mint pattern: "${match}".`),
      ...roleMatches.map((match) => `Found mint-role pattern: "${match}".`),
    ];
  }

  return [
    `Scanned for mint patterns: ${MINT_CAPABILITY_MINT_PATTERNS.join(", ")}.`,
    `Scanned for mint-role patterns: ${MINT_CAPABILITY_ROLE_PATTERNS.join(", ")}.`,
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

const buildMintCapabilityCheck = (
  explorerFacts?: ExplorerFacts
): MintCapabilityCheck => {
  const sourceFacts = explorerFacts?.source;
  const sourceStatus = sourceFacts?.data.sourceAvailable;
  const sourceCode = sourceFacts?.data.sourceCode ?? "";

  if (sourceStatus !== true || sourceCode.trim() === "") {
    const reason =
      sourceFacts?.error?.code ??
      (sourceStatus === false ? "source_unavailable" : "source_unavailable");
    return {
      id: "mint_capability",
      label: "Mint Capability",
      result: "unknown",
      short: MINT_CAPABILITY_SHORT,
      detail: MINT_CAPABILITY_DETAIL,
      evidence: buildMintCapabilityEvidence([], [], reason),
      howToVerify: MINT_CAPABILITY_VERIFY_STEPS,
    };
  }

  const sourceLower = sourceCode.toLowerCase();
  const mintMatches = MINT_CAPABILITY_MINT_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const roleMatches = MINT_CAPABILITY_ROLE_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );

  let result: MintCapabilityCheck["result"] = "ok";
  if (mintMatches.length > 0 && roleMatches.length > 0) {
    result = "high";
  } else if (mintMatches.length > 0 || roleMatches.length > 0) {
    result = "warn";
  }

  return {
    id: "mint_capability",
    label: "Mint Capability",
    result,
    short: MINT_CAPABILITY_SHORT,
    detail: MINT_CAPABILITY_DETAIL,
    evidence: buildMintCapabilityEvidence(mintMatches, roleMatches),
    howToVerify: MINT_CAPABILITY_VERIFY_STEPS,
  };
};

const buildLiquidityLockCheck = (): LiquidityLockCheck => ({
  id: "liquidity_lock",
  label: "Liquidity Lock Status",
  result: "unknown",
  short: LIQUIDITY_LOCK_SHORT,
  detail: LIQUIDITY_LOCK_DETAIL,
  evidence: ["LP lock status could not be verified (Phase 1 limitation)."],
  howToVerify: LIQUIDITY_LOCK_VERIFY_STEPS,
});

const buildHolderConcentrationEvidence = (
  top1: number,
  top5: number,
  top10: number
): string[] => [
  `Top 1 holders: ${top1.toFixed(1)}%`,
  `Top 5 holders: ${top5.toFixed(1)}%`,
  `Top 10 holders: ${top10.toFixed(1)}%`,
  "Source: explorer API",
];

const holderConcentrationResult = (
  top1: number,
  top5: number,
  top10: number
): HolderConcentrationCheck["result"] => {
  if (top1 >= 50 || top5 >= 80 || top10 >= 90) {
    return "high";
  }

  if (top1 >= 30 || top5 >= 60 || top10 >= 75) {
    return "warn";
  }

  return "ok";
};

const holderConcentrationReason = (
  code?: ExplorerErrorCode
): string => {
  switch (code) {
    case "missing_api_key":
      return "Explorer API key is missing for holder list data.";
    case "rate_limited":
      return "Explorer rate limit blocked holder list retrieval.";
    case "not_supported":
      return "Explorer does not support holder lists for this chain.";
    case "timeout":
      return "Explorer request timed out while fetching holders.";
    case "unavailable_on_free_plan":
      return "Holder list data is unavailable on the free explorer plan.";
    case "upstream_error":
    default:
      return "Explorer holder list could not be retrieved.";
  }
};

const buildHolderConcentrationCheck = (
  explorerFacts?: ExplorerFacts
): HolderConcentrationCheck => {
  const holderFacts = explorerFacts?.holders;
  const topHolderPercents = holderFacts?.data.topHolderPercents ?? [];

  if (topHolderPercents.length >= 10) {
    const top1 = topHolderPercents[0];
    const top5 = topHolderPercents.slice(0, 5).reduce((sum, value) => sum + value, 0);
    const top10 = topHolderPercents
      .slice(0, 10)
      .reduce((sum, value) => sum + value, 0);

    return {
      id: "holder_concentration",
      label: "Holder Concentration",
      result: holderConcentrationResult(top1, top5, top10),
      short: HOLDER_CONCENTRATION_SHORT,
      detail: HOLDER_CONCENTRATION_DETAIL,
      evidence: buildHolderConcentrationEvidence(top1, top5, top10),
      howToVerify: HOLDER_CONCENTRATION_VERIFY_STEPS,
    };
  }

  const reason = holderConcentrationReason(holderFacts?.error?.code);

  return {
    id: "holder_concentration",
    label: "Holder Concentration",
    result: "unknown",
    short: HOLDER_CONCENTRATION_SHORT,
    detail: `${HOLDER_CONCENTRATION_DETAIL} ${reason}`,
    evidence: [reason],
    howToVerify: HOLDER_CONCENTRATION_VERIFY_STEPS,
  };
};

const tradingEnableControlReason = (
  code?: ExplorerErrorCode | "source_unavailable"
): string => {
  switch (code) {
    case "missing_api_key":
      return "Explorer API key is missing for contract source data.";
    case "rate_limited":
      return "Explorer rate limit blocked contract source retrieval.";
    case "not_supported":
      return "Explorer does not support contract source on this chain.";
    case "timeout":
      return "Explorer request timed out while fetching contract source data.";
    case "unavailable_on_free_plan":
      return "Contract source data is unavailable on the free explorer plan.";
    case "source_unavailable":
      return "Verified source code is unavailable.";
    case "upstream_error":
    default:
      return "Explorer contract source data could not be retrieved.";
  }
};

const buildTradingEnableControlEvidence = (
  matches: string[],
  reason?: ExplorerErrorCode | "source_unavailable"
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  if (matches.length > 0) {
    return matches.map((match) => `Detected signal: ${match}`);
  }

  return [
    `Scanned for patterns: ${[
      ...TRADING_ENABLE_CONTROL_HIGH_PATTERNS,
      ...TRADING_ENABLE_CONTROL_WARN_PATTERNS,
    ].join(", ")}.`,
  ];
};

const buildTradingEnableControlCheck = (
  explorerFacts?: ExplorerFacts
): TradingEnableControlCheck => {
  const sourceFacts = explorerFacts?.source;
  const sourceStatus = sourceFacts?.data.sourceAvailable;
  const sourceCode = sourceFacts?.data.sourceCode ?? "";

  if (sourceStatus !== true || sourceCode.trim() === "") {
    const reason =
      sourceFacts?.error?.code ??
      (sourceStatus === false ? "source_unavailable" : "source_unavailable");
    return {
      id: "trading_enable_control",
      label: "Trading Enable Control",
      result: "unknown",
      short: TRADING_ENABLE_CONTROL_SHORT,
      detail: `${TRADING_ENABLE_CONTROL_DETAIL} ${tradingEnableControlReason(
        reason
      )}`,
      evidence: buildTradingEnableControlEvidence([], reason),
      howToVerify: TRADING_ENABLE_CONTROL_VERIFY_STEPS,
    };
  }

  const sourceLower = sourceCode.toLowerCase();
  const highMatches = TRADING_ENABLE_CONTROL_HIGH_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const warnMatches = TRADING_ENABLE_CONTROL_WARN_PATTERNS.filter((pattern) =>
    sourceLower.includes(pattern.toLowerCase())
  );
  const matches = [...highMatches, ...warnMatches];

  let result: TradingEnableControlCheck["result"] = "ok";
  if (highMatches.length > 0) {
    result = "high";
  } else if (warnMatches.length > 0) {
    result = "warn";
  }

  return {
    id: "trading_enable_control",
    label: "Trading Enable Control",
    result,
    short: TRADING_ENABLE_CONTROL_SHORT,
    detail: TRADING_ENABLE_CONTROL_DETAIL,
    evidence: buildTradingEnableControlEvidence(matches),
    howToVerify: TRADING_ENABLE_CONTROL_VERIFY_STEPS,
  };
};

const contractVerificationReason = (
  code?: ExplorerErrorCode
): string => {
  switch (code) {
    case "missing_api_key":
      return "Explorer API key is missing for contract verification data.";
    case "rate_limited":
      return "Explorer rate limit blocked contract verification data.";
    case "not_supported":
      return "Explorer does not support contract verification on this chain.";
    case "timeout":
      return "Explorer request timed out while fetching contract verification data.";
    case "unavailable_on_free_plan":
      return "Contract verification data is unavailable on the free explorer plan.";
    case "upstream_error":
    default:
      return "Explorer contract verification data could not be retrieved.";
  }
};

const buildContractVerificationEvidence = (
  chain: string,
  address: string,
  sourceAvailable?: ExplorerValue,
  errorCode?: ExplorerErrorCode
): string[] => {
  const explorerUrl = buildExplorerAddressUrl(chain, address);
  const urlSuffix = explorerUrl ? ` (${explorerUrl})` : "";

  if (sourceAvailable === true) {
    return [`Verified source code: yes${urlSuffix}`];
  }

  if (sourceAvailable === false) {
    return [`Verified source code: no${urlSuffix}`];
  }

  const reason = contractVerificationReason(errorCode);
  return [explorerUrl ? `${reason} (${explorerUrl})` : reason];
};

const buildContractVerificationCheck = (
  chain: string,
  address: string,
  explorerFacts?: ExplorerFacts
): ContractVerificationCheck => {
  const sourceFacts = explorerFacts?.source;
  const sourceStatus = sourceFacts?.data.sourceAvailable;
  const evidence = buildContractVerificationEvidence(
    chain,
    address,
    sourceStatus,
    sourceFacts?.error?.code
  );

  let result: ContractVerificationCheck["result"] = "unknown";
  if (sourceStatus === true) {
    result = "ok";
  } else if (sourceStatus === false) {
    result = "warn";
  }

  return {
    id: "contract_verification",
    label: "Contract Verification",
    result,
    short: CONTRACT_VERIFICATION_SHORT,
    detail: CONTRACT_VERIFICATION_DETAIL,
    evidence,
    howToVerify: CONTRACT_VERIFICATION_VERIFY_STEPS,
  };
};

const buildInspectPayload = (
  chain: string,
  address: string,
  cached: boolean,
  generatedAt: string,
  explorerFacts?: ExplorerFacts
) => {
  const checks = [
    buildSellRestrictionCheck(explorerFacts ?? undefined),
    buildOwnerPrivilegesCheck(explorerFacts ?? undefined),
    buildMintCapabilityCheck(explorerFacts ?? undefined),
    buildLiquidityLockCheck(),
    buildHolderConcentrationCheck(explorerFacts ?? undefined),
    buildContractVerificationCheck(chain, address, explorerFacts ?? undefined),
    buildTradingEnableControlCheck(explorerFacts ?? undefined),
    {
      id: "dummy_format",
      label: "Output format",
      status: "ok",
      why: "The endpoint returns explainable JSON with neutral language.",
      evidence: [],
    },
  ];
  const overallRisk = buildOverallRisk(checks);
  const summary = buildSummary(overallRisk);
  const topReasons = buildTopReasons(checks);

  return {
    ok: true,
    input: { chain, address },
    result: {
      overallRisk,
      summary,
      topReasons,
    },
    checks,
    meta: { generatedAt, cached },
  };
};

export default {
  async fetch(
    request: Request,
    env?: { ETHERSCAN_API_KEY?: string }
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "OPTIONS" &&
      (url.pathname === "/api/inspect" || url.pathname === "/api/hello")
    ) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/api/hello") {
      return withCors(jsonResponse({ ok: true, message: "hello" }));
    }

    if (request.method === "GET" && url.pathname === "/api/inspect") {
      const chain = url.searchParams.get("chain");
      const address = url.searchParams.get("address");

      if (!chain || !address) {
        return withCors(
          errorResponse("Missing required query parameters: chain and address.")
        );
      }

      if (!isValidAddress(address)) {
        return withCors(errorResponse("Invalid address format."));
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
        return withCors(cachedResponse);
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
          headers: { "Cache-Control": CACHE_CONTROL, ...CORS_HEADERS },
        });

        const cachedBody = buildInspectPayload(
          chain,
          address,
          true,
          generatedAt,
          explorerFacts
        );
        const cacheResponse = jsonResponse(cachedBody, {
          headers: { "Cache-Control": CACHE_CONTROL, ...CORS_HEADERS },
        });

        await cache.put(cacheKey, cacheResponse.clone());
        return withCors(response);
      } catch (error) {
        cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return withCors(cachedResponse);
        }
        return withCors(
          errorResponse("Unexpected error while generating response.", 500)
        );
      }
    }

    return jsonResponse(
      { ok: false, error: { code: "not_found", message: "Not found" } },
      { status: 404 }
    );
  },
};
