import { fetchExplorerFacts } from "./explorer/client";
import type { Chain, ExplorerFacts, ExplorerValue } from "./explorer/types";
import {
  InspectRouteError,
  type InspectError,
  type InspectErrorCode,
  type InputErrorCode,
  getBlockingUpstreamError,
} from "./utils/errors";
import { findSignals, formatEvidence, preprocessSource, type SignalPattern } from "./utils/sourceScan";
import { fetchTokenIdentity } from "./providers/tokenIdentity";
import type { TokenIdentityResult } from "./providers/tokenIdentityTypes";

const jsonResponse = (body: unknown, init?: ResponseInit): Response => {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

const isValidAddress = (address: string): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(address);
const isValidChain = (chain: string): chain is Chain =>
  chain === "eth" || chain === "bsc";

const CACHE_TTL_SECONDS = 86400;
const CACHE_CONTROL = `public, max-age=${CACHE_TTL_SECONDS}`;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;
const CACHE_HEADER_NAME = "x-tsi-cache";

type CacheState = "HIT" | "MISS" | "STALE";

type InspectSuccessResponse = ReturnType<typeof buildInspectPayload>;

type Env = {
  ETHERSCAN_API_KEY?: string;
  ETH_RPC_URL?: string;
  BSC_RPC_URL?: string;
};

type InspectErrorResponse = {
  ok: false;
  error: {
    code: InspectErrorCode;
    message: string;
    detail?: InspectError["detail"];
  };
  meta: {
    ts: string;
    generatedAt: string;
    cached: false;
  };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCorsAndCache = (
  response: Response,
  cacheState: CacheState
): Response => {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  headers.set(CACHE_HEADER_NAME, cacheState);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const buildMetaTs = (): string => new Date().toISOString();

const createInputError = (code: InputErrorCode, message: string): InspectRouteError =>
  new InspectRouteError({ code, message, status: 400 });

const buildErrorResponse = (inspectError: InspectError): Response => {
  const ts = buildMetaTs();
  const body: InspectErrorResponse = {
    ok: false,
    error: {
      code: inspectError.code,
      message: inspectError.message,
      ...(inspectError.detail ? { detail: inspectError.detail } : {}),
    },
    meta: { ts, generatedAt: ts, cached: false },
  };
  return jsonResponse(body, { status: inspectError.status });
};

const buildRateLimitKey = (origin: string, ip: string): Request => {
  const keyUrl = new URL("/__rl__/inspect", origin);
  keyUrl.searchParams.set("ip", ip);
  keyUrl.searchParams.set("window", RATE_LIMIT_WINDOW_SECONDS.toString());
  return new Request(keyUrl.toString(), { method: "GET" });
};

const buildRateLimitExceededResponse = (): Response => {
  const ts = buildMetaTs();
  return jsonResponse(
    {
      ok: false,
      error: {
        code: "rate_limited",
        message: "Too many requests. Please try again later.",
        detail: { hint: "Please try again later.", status: 429 },
      },
      meta: { ts, generatedAt: ts, cached: false },
    },
    {
      status: 429,
      headers: {
        "Retry-After": RATE_LIMIT_WINDOW_SECONDS.toString(),
      },
    }
  );
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

const SELL_RESTRICTION_HIGH_PATTERNS: SignalPattern[] = [
  { name: "blacklist", regex: /\bblacklist(ed)?\b/, strength: "strong" },
  { name: "whitelist", regex: /\bwhitelist(ed)?\b/, strength: "strong" },
  {
    name: "tradingEnabled",
    regex: /\btrading\s*enabled\b|\btradingEnabled\b/,
    strength: "strong",
  },
  { name: "enableTrading", regex: /\benableTrading\b/, strength: "strong" },
  { name: "tradingOpen", regex: /\btradingOpen\b/, strength: "strong" },
  {
    name: "whenTradingEnabled",
    regex: /\bwhenTradingEnabled\b/,
    strength: "strong",
  },
];

const SELL_RESTRICTION_WARN_PATTERNS: SignalPattern[] = [
  { name: "antiBot", regex: /\bantiBot\b/, strength: "weak" },
  { name: "cooldown", regex: /\bcooldown\b/, strength: "weak" },
  { name: "transferDelay", regex: /\btransferDelay\b/, strength: "weak" },
  { name: "maxSell", regex: /\bmaxSell\b/, strength: "weak" },
  { name: "sellLimit", regex: /\bsellLimit\b/, strength: "weak" },
  { name: "sellTax", regex: /\bsellTax\b/, strength: "weak" },
];

const OWNER_PRIVILEGES_OWNER_PATTERNS: SignalPattern[] = [
  { name: "owner", regex: /\bowner\b/, strength: "strong" },
  { name: "onlyOwner", regex: /\bonlyOwner\b/, strength: "strong" },
  {
    name: "transferOwnership",
    regex: /\btransferOwnership\b/,
    strength: "strong",
  },
  {
    name: "renounceOwnership",
    regex: /\brenounceOwnership\b/,
    strength: "strong",
  },
  { name: "ownable", regex: /\bownable\b/, strength: "strong" },
];

const OWNER_PRIVILEGES_HIGH_PATTERNS: SignalPattern[] = [
  { name: "blacklist", regex: /\bblacklist(ed)?\b/, strength: "strong" },
  { name: "whitelist", regex: /\bwhitelist(ed)?\b/, strength: "strong" },
];

const OWNER_PRIVILEGES_WARN_PATTERNS: SignalPattern[] = [
  { name: "setFee", regex: /\bsetFee\b/, strength: "weak" },
  { name: "setTax", regex: /\bsetTax\b/, strength: "weak" },
  { name: "setMaxTx", regex: /\bsetMaxTx\b/, strength: "weak" },
  { name: "setMaxWallet", regex: /\bsetMaxWallet\b/, strength: "weak" },
  { name: "setLimits", regex: /\bsetLimits\b/, strength: "weak" },
  { name: "setLimit", regex: /\bsetLimit\b/, strength: "weak" },
  { name: "enableTrading", regex: /\benableTrading\b/, strength: "weak" },
  {
    name: "tradingEnabled",
    regex: /\btrading\s*enabled\b|\btradingEnabled\b/,
    strength: "weak",
  },
];

const MINT_CAPABILITY_MINT_PATTERNS: SignalPattern[] = [
  { name: "mint", regex: /\bmint(ing)?\b/, strength: "strong" },
  { name: "_mint", regex: /\b_mint\b/, strength: "strong" },
  { name: "mintTo", regex: /\bmintTo\b/, strength: "strong" },
  { name: "mint(address)", regex: /\bmint\s*\(\s*address\b/, strength: "strong" },
  {
    name: "increaseSupply",
    regex: /\bincreaseSupply\b/,
    strength: "strong",
  },
  {
    name: "setMinter",
    regex: /\bsetMinter\b|\bsetminter\b/,
    strength: "strong",
  },
];

const MINT_CAPABILITY_ROLE_PATTERNS: SignalPattern[] = [
  { name: "minter_role", regex: /\bminter_role\b/, strength: "weak" },
  { name: "onlyminter", regex: /\bonlyminter\b/, strength: "weak" },
  { name: "addminter", regex: /\baddminter\b/, strength: "weak" },
];

const TRADING_ENABLE_CONTROL_HIGH_PATTERNS: SignalPattern[] = [
  { name: "pause", regex: /\bpause(d)?\b/, strength: "strong" },
  { name: "unpause", regex: /\bunpause(d)?\b/, strength: "strong" },
  { name: "disableTrading", regex: /\bdisableTrading\b/, strength: "strong" },
  { name: "stopTrading", regex: /\bstopTrading\b/, strength: "strong" },
  { name: "resumeTrading", regex: /\bresumeTrading\b/, strength: "strong" },
];

const TRADING_ENABLE_CONTROL_WARN_PATTERNS: SignalPattern[] = [
  {
    name: "tradingEnabled",
    regex: /\btrading\s*enabled\b|\btradingEnabled\b/,
    strength: "weak",
  },
  { name: "enableTrading", regex: /\benableTrading\b/, strength: "weak" },
  { name: "setTrading", regex: /\bsetTrading\b/, strength: "weak" },
  { name: "openTrading", regex: /\bopenTrading\b/, strength: "weak" },
  { name: "tradingActive", regex: /\btradingActive\b/, strength: "weak" },
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
  matches: ReturnType<typeof findSignals>,
  preprocess: ReturnType<typeof preprocessSource>["removed"],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  return [formatEvidence(matches, { preprocess })];
};

const buildOwnerPrivilegesEvidence = (
  ownerMatches: ReturnType<typeof findSignals>,
  changeMatches: ReturnType<typeof findSignals>,
  preprocess: ReturnType<typeof preprocessSource>["removed"],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  return [formatEvidence([...ownerMatches, ...changeMatches], { preprocess })];
};

const buildMintCapabilityEvidence = (
  mintMatches: ReturnType<typeof findSignals>,
  roleMatches: ReturnType<typeof findSignals>,
  preprocess: ReturnType<typeof preprocessSource>["removed"],
  reason?: string
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  return [formatEvidence([...mintMatches, ...roleMatches], { preprocess })];
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
      evidence: buildSellRestrictionEvidence(
        [],
        { comments: 0, strings: 0, failed: true },
        reason
      ),
      howToVerify: SELL_RESTRICTION_VERIFY_STEPS,
    };
  }

  const preprocessed = preprocessSource(sourceCode);
  const highMatches = findSignals(preprocessed.cleaned, SELL_RESTRICTION_HIGH_PATTERNS);
  const warnMatches = findSignals(preprocessed.cleaned, SELL_RESTRICTION_WARN_PATTERNS);
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
    evidence: buildSellRestrictionEvidence(matches, preprocessed.removed),
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
      evidence: buildOwnerPrivilegesEvidence(
        [],
        [],
        { comments: 0, strings: 0, failed: true },
        reason
      ),
      howToVerify: OWNER_PRIVILEGES_VERIFY_STEPS,
    };
  }

  const preprocessed = preprocessSource(sourceCode);
  const ownerMatches = findSignals(preprocessed.cleaned, OWNER_PRIVILEGES_OWNER_PATTERNS);
  const changeHighMatches = findSignals(
    preprocessed.cleaned,
    OWNER_PRIVILEGES_HIGH_PATTERNS
  );
  const changeWarnMatches = findSignals(
    preprocessed.cleaned,
    OWNER_PRIVILEGES_WARN_PATTERNS
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
    evidence: buildOwnerPrivilegesEvidence(
      ownerMatches,
      changeMatches,
      preprocessed.removed
    ),
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
      evidence: buildMintCapabilityEvidence(
        [],
        [],
        { comments: 0, strings: 0, failed: true },
        reason
      ),
      howToVerify: MINT_CAPABILITY_VERIFY_STEPS,
    };
  }

  const preprocessed = preprocessSource(sourceCode);
  const mintMatches = findSignals(preprocessed.cleaned, MINT_CAPABILITY_MINT_PATTERNS);
  const roleMatches = findSignals(preprocessed.cleaned, MINT_CAPABILITY_ROLE_PATTERNS);

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
    evidence: buildMintCapabilityEvidence(
      mintMatches,
      roleMatches,
      preprocessed.removed
    ),
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
  matches: ReturnType<typeof findSignals>,
  preprocess: ReturnType<typeof preprocessSource>["removed"],
  reason?: ExplorerErrorCode | "source_unavailable"
): string[] => {
  if (reason) {
    return [`Source unavailable: ${reason}.`];
  }

  return [formatEvidence(matches, { preprocess })];
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
      evidence: buildTradingEnableControlEvidence(
        [],
        { comments: 0, strings: 0, failed: true },
        reason
      ),
      howToVerify: TRADING_ENABLE_CONTROL_VERIFY_STEPS,
    };
  }

  const preprocessed = preprocessSource(sourceCode);
  const highMatches = findSignals(
    preprocessed.cleaned,
    TRADING_ENABLE_CONTROL_HIGH_PATTERNS
  );
  const warnMatches = findSignals(
    preprocessed.cleaned,
    TRADING_ENABLE_CONTROL_WARN_PATTERNS
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
    evidence: buildTradingEnableControlEvidence(matches, preprocessed.removed),
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
  explorerFacts?: ExplorerFacts,
  tokenIdentity?: TokenIdentityResult,
  stale = false,
  ts = buildMetaTs()
) => {
  const checks = [
    buildSellRestrictionCheck(explorerFacts ?? undefined),
    buildOwnerPrivilegesCheck(explorerFacts ?? undefined),
    buildMintCapabilityCheck(explorerFacts ?? undefined),
    buildLiquidityLockCheck(),
    buildHolderConcentrationCheck(explorerFacts ?? undefined),
    buildContractVerificationCheck(chain, address, explorerFacts ?? undefined),
    buildTradingEnableControlCheck(explorerFacts ?? undefined),
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
      ...(tokenIdentity ? { token: tokenIdentity } : {}),
    },
    checks,
    meta: { generatedAt, cached, stale, ts },
  };
};

type CachedInspectPayload = InspectSuccessResponse;

const buildFailedTokenIdentity = (notes: string): TokenIdentityResult => ({
  name: null,
  symbol: null,
  decimals: null,
  evidence: {
    source: "rpc_eth_call",
    status: "failed",
    notes,
  },
});

const readCachedPayload = async (
  response: Response
): Promise<CachedInspectPayload | null> => {
  try {
    return (await response.clone().json()) as CachedInspectPayload;
  } catch (error) {
    return null;
  }
};

const buildCachedResponseFromPayload = (
  payload: CachedInspectPayload
): Response =>
  jsonResponse(payload, {
    headers: { "Cache-Control": CACHE_CONTROL, ...CORS_HEADERS },
  });

const buildStalePayload = (payload: CachedInspectPayload): CachedInspectPayload => {
  const ts = buildMetaTs();
  return {
    ...payload,
    meta: {
      ...payload.meta,
      cached: true,
      stale: true,
      ts,
    },
  };
};

export default {
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "OPTIONS" &&
      (url.pathname === "/api/inspect" || url.pathname === "/api/hello")
    ) {
      return withCorsAndCache(new Response(null, { status: 204 }), "MISS");
    }

    if (request.method === "GET" && url.pathname === "/api/hello") {
      return withCorsAndCache(jsonResponse({ ok: true, message: "hello" }), "MISS");
    }

    if (request.method === "GET" && url.pathname === "/api/inspect") {
      const cache = caches.default;
      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const rateLimitKey = buildRateLimitKey(url.origin, ip);

      try {
        const rateLimitMatch = await cache.match(rateLimitKey);
        let requestCount = 0;

        if (rateLimitMatch) {
          const data = (await rateLimitMatch.json().catch(() => null)) as
            | { count?: number }
            | null;
          if (data && typeof data.count === "number") {
            requestCount = data.count;
          }
        }

        if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
          return withCorsAndCache(buildRateLimitExceededResponse(), "MISS");
        }

        const rateLimitResponse = jsonResponse(
          {
            count: requestCount + 1,
            windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
            ip,
          },
          {
            headers: {
              "Cache-Control": `max-age=${RATE_LIMIT_WINDOW_SECONDS}`,
            },
          }
        );
        await cache.put(rateLimitKey, rateLimitResponse);
      } catch (error) {
        // Best-effort limiter; ignore cache failures.
      }

      const chain = url.searchParams.get("chain");
      const address = url.searchParams.get("address");

      if (!chain || !address) {
        return withCorsAndCache(
          buildErrorResponse(
            createInputError(
              "missing_params",
              "Missing required query parameters: chain and address."
            )
          ),
          "MISS"
        );
      }

      if (!isValidAddress(address)) {
        return withCorsAndCache(
          buildErrorResponse(
            createInputError("invalid_address", "Invalid address format.")
          ),
          "MISS"
        );
      }

      if (!isValidChain(chain)) {
        return withCorsAndCache(
          buildErrorResponse(
            createInputError("invalid_chain", "Invalid chain. Use eth or bsc.")
          ),
          "MISS"
        );
      }

      const cacheKeyUrl = new URL("/api/inspect", url.origin);
      cacheKeyUrl.searchParams.set("chain", chain);
      cacheKeyUrl.searchParams.set("address", address);
      const cacheKey = new Request(cacheKeyUrl.toString(), {
        method: "GET",
      });
      let cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const cachedPayload = await readCachedPayload(cachedResponse);
        if (cachedPayload) {
          const payloadWithTs = cachedPayload.meta.ts
            ? cachedPayload
            : {
                ...cachedPayload,
                meta: {
                  ...cachedPayload.meta,
                  cached: true,
                  stale: false,
                  ts: buildMetaTs(),
                },
              };
          return withCorsAndCache(
            buildCachedResponseFromPayload(payloadWithTs),
            "HIT"
          );
        }
        return withCorsAndCache(cachedResponse, "HIT");
      }

      try {
        const generatedAt = buildMetaTs();
        const explorerFacts = await fetchExplorerFacts(
          chain as Chain,
          address,
          env.ETHERSCAN_API_KEY
        );
        const blockingError = getBlockingUpstreamError(explorerFacts);
        if (blockingError) {
          throw new InspectRouteError(blockingError);
        }

        let tokenIdentity: TokenIdentityResult;
        try {
          tokenIdentity = await fetchTokenIdentity(
            cache,
            url.origin,
            chain as Chain,
            address,
            env
          );
        } catch (error) {
          tokenIdentity = buildFailedTokenIdentity("token_identity_unavailable");
        }

        const responseBody = buildInspectPayload(
          chain,
          address,
          false,
          generatedAt,
          explorerFacts,
          tokenIdentity,
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
          generatedAt,
          explorerFacts,
          tokenIdentity,
          false,
          generatedAt
        );
        const cacheResponse = buildCachedResponseFromPayload(cachedBody);

        await cache.put(cacheKey, cacheResponse.clone());
        return withCorsAndCache(response, "MISS");
      } catch (error) {
        cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          const cachedPayload = await readCachedPayload(cachedResponse);
          if (cachedPayload) {
            return withCorsAndCache(
              buildCachedResponseFromPayload(buildStalePayload(cachedPayload)),
              "STALE"
            );
          }
          return withCorsAndCache(cachedResponse, "STALE");
        }

        const inspectError =
          error instanceof InspectRouteError
            ? error.inspectError
            : ({
                code: "upstream_error",
                message: "Unexpected upstream failure.",
                status: 502,
              } satisfies InspectError);
        return withCorsAndCache(buildErrorResponse(inspectError), "MISS");
      }
    }

    return withCorsAndCache(
      jsonResponse(
        { ok: false, error: { code: "not_found", message: "Not found" } },
        { status: 404 }
      ),
      "MISS"
    );
  },
};
