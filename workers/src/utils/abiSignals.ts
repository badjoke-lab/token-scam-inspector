export type AbiSignalKey =
  | "pause"
  | "unpause"
  | "blacklist"
  | "whitelist"
  | "tradingEnableToggle"
  | "mint"
  | "minterRole"
  | "ownerSetter";

export type AbiSignals = {
  hasPause: boolean;
  hasUnpause: boolean;
  hasBlacklist: boolean;
  hasWhitelist: boolean;
  hasTradingEnableToggle: boolean;
  hasMint: boolean;
  hasMinterRole: boolean;
  hasOwnerSetter: boolean;
  matchedFunctions: string[];
  matchedBySignal: Record<AbiSignalKey, string[]>;
};

type SignalMatcher = {
  key: AbiSignalKey;
  test: (name: string) => boolean;
};

type AbiEntry = {
  type?: unknown;
  name?: unknown;
};

const SIGNAL_MATCHERS: SignalMatcher[] = [
  { key: "pause", test: (name) => name === "pause" },
  { key: "unpause", test: (name) => name === "unpause" },
  { key: "blacklist", test: (name) => name.includes("blacklist") },
  { key: "whitelist", test: (name) => name.includes("whitelist") },
  {
    key: "tradingEnableToggle",
    test: (name) =>
      name.includes("enabletrading") ||
      name.includes("disabletrading") ||
      name.includes("opentrading") ||
      name.includes("settrading"),
  },
  {
    key: "mint",
    test: (name) =>
      name === "mint" || name.startsWith("mint") || name.includes("_mint"),
  },
  {
    key: "minterRole",
    test: (name) =>
      name.includes("setminter") ||
      name.includes("addminter") ||
      name.includes("grantrole") ||
      name.includes("minterrole"),
  },
  {
    key: "ownerSetter",
    test: (name) =>
      name.includes("transferownership") ||
      name.includes("renounceownership") ||
      name.includes("setowner"),
  },
];

const EMPTY_MATCHED_BY_SIGNAL: Record<AbiSignalKey, string[]> = {
  pause: [],
  unpause: [],
  blacklist: [],
  whitelist: [],
  tradingEnableToggle: [],
  mint: [],
  minterRole: [],
  ownerSetter: [],
};

const toLower = (value: string): string => value.toLowerCase();

const getFunctionName = (entry: AbiEntry): string | null => {
  if (typeof entry?.name !== "string") {
    return null;
  }
  const trimmed = entry.name.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isFunctionEntry = (entry: AbiEntry): boolean => {
  if (typeof entry?.type !== "string") {
    return true;
  }
  return entry.type === "function";
};

const uniquePush = (list: string[], value: string): void => {
  if (!list.includes(value)) {
    list.push(value);
  }
};

export const extractAbiSignals = (abi: unknown[]): AbiSignals => {
  const matchedBySignal = {
    pause: [],
    unpause: [],
    blacklist: [],
    whitelist: [],
    tradingEnableToggle: [],
    mint: [],
    minterRole: [],
    ownerSetter: [],
  } satisfies Record<AbiSignalKey, string[]>;
  const matchedFunctions: string[] = [];

  if (!Array.isArray(abi)) {
    return {
      hasPause: false,
      hasUnpause: false,
      hasBlacklist: false,
      hasWhitelist: false,
      hasTradingEnableToggle: false,
      hasMint: false,
      hasMinterRole: false,
      hasOwnerSetter: false,
      matchedFunctions,
      matchedBySignal: { ...EMPTY_MATCHED_BY_SIGNAL },
    };
  }

  for (const entry of abi) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const abiEntry = entry as AbiEntry;
    if (!isFunctionEntry(abiEntry)) {
      continue;
    }

    const functionName = getFunctionName(abiEntry);
    if (!functionName) {
      continue;
    }

    const lowered = toLower(functionName);

    for (const matcher of SIGNAL_MATCHERS) {
      let matched = false;
      try {
        matched = matcher.test(lowered);
      } catch (_error) {
        matched = false;
      }
      if (!matched) {
        continue;
      }

      uniquePush(matchedBySignal[matcher.key], functionName);
      uniquePush(matchedFunctions, functionName);
    }
  }

  return {
    hasPause: matchedBySignal.pause.length > 0,
    hasUnpause: matchedBySignal.unpause.length > 0,
    hasBlacklist: matchedBySignal.blacklist.length > 0,
    hasWhitelist: matchedBySignal.whitelist.length > 0,
    hasTradingEnableToggle: matchedBySignal.tradingEnableToggle.length > 0,
    hasMint: matchedBySignal.mint.length > 0,
    hasMinterRole: matchedBySignal.minterRole.length > 0,
    hasOwnerSetter: matchedBySignal.ownerSetter.length > 0,
    matchedFunctions,
    matchedBySignal,
  };
};

export const collectAbiFunctionEvidence = (
  signals: AbiSignals,
  keys: AbiSignalKey[],
  limit = 5
): string[] => {
  const collected: string[] = [];
  for (const key of keys) {
    const names = signals.matchedBySignal[key] ?? [];
    for (const name of names) {
      uniquePush(collected, name);
      if (collected.length >= limit) {
        return collected;
      }
    }
  }
  return collected;
};
