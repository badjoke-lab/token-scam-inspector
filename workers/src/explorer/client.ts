import {
  type Chain,
  type ContractCreationFacts,
  type ContractSourceFacts,
  type ExplorerError,
  type ExplorerFacts,
  type ExplorerResult,
  type HolderFacts,
} from "./types";

const BASE_URL = "https://api.etherscan.io/v2/api";
const CHAIN_IDS: Record<Chain, number> = { eth: 1, bsc: 56 };
const DEFAULT_TIMEOUT_MS = 8000;

const unknownSourceFacts: ContractSourceFacts = {
  sourceAvailable: "unknown",
  isProxy: "unknown",
  sourceCode: "",
};

const unknownCreationFacts: ContractCreationFacts = {
  creatorAddress: "unknown",
  creationTxHash: "unknown",
};

const unknownHolderFacts: HolderFacts = {
  holderListAvailable: "unknown",
  topHolderPercents: [],
};

export const fetchJsonWithTimeout = async (
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ data?: unknown; error?: ExplorerError }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        error: {
          code: "upstream_error",
          message: `Explorer responded with status ${response.status}.`,
          upstream: "etherscan",
        },
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        error: {
          code: "timeout",
          message: "Explorer request timed out.",
          upstream: "etherscan",
        },
      };
    }
    return {
      error: {
        code: "upstream_error",
        message: "Explorer request failed.",
        upstream: "etherscan",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeEtherscanError = (payload: unknown): ExplorerError => {
  const message =
    payload && typeof payload === "object" && "result" in payload
      ? String((payload as { result?: string }).result ?? "Unknown error")
      : "Unknown error";
  const lowered = message.toLowerCase();

  if (lowered.includes("rate limit") || lowered.includes("max rate limit")) {
    return {
      code: "rate_limited",
      message: "Explorer rate limit reached.",
      upstream: "etherscan",
    };
  }

  if (lowered.includes("missing api key")) {
    return {
      code: "missing_api_key",
      message: "Explorer API key is missing.",
      upstream: "etherscan",
    };
  }

  if (
    lowered.includes("upgrade") ||
    lowered.includes("not available") ||
    lowered.includes("pro") ||
    lowered.includes("premium")
  ) {
    return {
      code: "unavailable_on_free_plan",
      message: "Explorer feature is unavailable on the free plan.",
      upstream: "etherscan",
    };
  }

  return {
    code: "upstream_error",
    message: "Explorer returned an error response.",
    upstream: "etherscan",
  };
};

const parseEtherscanResult = (
  payload: unknown
): { result?: unknown; error?: ExplorerError } => {
  if (!payload || typeof payload !== "object") {
    return {
      error: {
        code: "upstream_error",
        message: "Explorer response was not an object.",
        upstream: "etherscan",
      },
    };
  }

  const status = String((payload as { status?: string }).status ?? "");
  if (status === "1") {
    return { result: (payload as { result?: unknown }).result };
  }

  if (status === "0") {
    return { error: normalizeEtherscanError(payload) };
  }

  return {
    error: {
      code: "upstream_error",
      message: "Explorer response had an unexpected status.",
      upstream: "etherscan",
    },
  };
};

const createUnsupportedChainError = (): ExplorerError => ({
  code: "not_supported",
  message: "Explorer does not support this chain.",
  upstream: "etherscan",
});

const createMissingKeyError = (): ExplorerError => ({
  code: "missing_api_key",
  message: "Explorer API key is missing.",
  upstream: "etherscan",
});

const getContractSourceFacts = async (
  chain: Chain,
  address: string,
  apiKey?: string
): Promise<ExplorerResult<ContractSourceFacts>> => {
  if (!apiKey) {
    return { data: { ...unknownSourceFacts }, error: createMissingKeyError() };
  }

  if (!(chain in CHAIN_IDS)) {
    return { data: { ...unknownSourceFacts }, error: createUnsupportedChainError() };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", CHAIN_IDS[chain].toString());
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", address);
  url.searchParams.set("apikey", apiKey);

  const response = await fetchJsonWithTimeout(url.toString());
  if (response.error) {
    return { data: { ...unknownSourceFacts }, error: response.error };
  }

  const parsed = parseEtherscanResult(response.data);
  if (parsed.error) {
    return { data: { ...unknownSourceFacts }, error: parsed.error };
  }

  if (!Array.isArray(parsed.result) || parsed.result.length === 0) {
    return {
      data: { ...unknownSourceFacts },
      error: {
        code: "upstream_error",
        message: "Explorer returned an empty result.",
        upstream: "etherscan",
      },
    };
  }

  const entry = parsed.result[0] as {
    SourceCode?: string;
    Proxy?: string;
  };
  const sourceCode = typeof entry?.SourceCode === "string" ? entry.SourceCode : "";
  const proxyFlag = entry?.Proxy;

  return {
    data: {
      sourceAvailable: sourceCode.trim() !== "",
      isProxy:
        proxyFlag === "1" ? true : proxyFlag === "0" ? false : "unknown",
      sourceCode,
    },
  };
};

const getContractCreationFacts = async (
  chain: Chain,
  address: string,
  apiKey?: string
): Promise<ExplorerResult<ContractCreationFacts>> => {
  if (!apiKey) {
    return { data: { ...unknownCreationFacts }, error: createMissingKeyError() };
  }

  if (!(chain in CHAIN_IDS)) {
    return {
      data: { ...unknownCreationFacts },
      error: createUnsupportedChainError(),
    };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", CHAIN_IDS[chain].toString());
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getcontractcreation");
  url.searchParams.set("contractaddresses", address);
  url.searchParams.set("apikey", apiKey);

  const response = await fetchJsonWithTimeout(url.toString());
  if (response.error) {
    return { data: { ...unknownCreationFacts }, error: response.error };
  }

  const parsed = parseEtherscanResult(response.data);
  if (parsed.error) {
    return { data: { ...unknownCreationFacts }, error: parsed.error };
  }

  if (!Array.isArray(parsed.result) || parsed.result.length === 0) {
    return {
      data: { ...unknownCreationFacts },
      error: {
        code: "upstream_error",
        message: "Explorer returned an empty result.",
        upstream: "etherscan",
      },
    };
  }

  const entry = parsed.result[0] as {
    contractCreator?: string;
    txHash?: string;
  };

  return {
    data: {
      creatorAddress:
        typeof entry?.contractCreator === "string" && entry.contractCreator
          ? entry.contractCreator
          : "unknown",
      creationTxHash:
        typeof entry?.txHash === "string" && entry.txHash
          ? entry.txHash
          : "unknown",
    },
  };
};

const parseNumericString = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[%\s,]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseBigIntString = (value: unknown): bigint | null => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return BigInt(value);
  }

  return null;
};

const findPercentInEntry = (entry: Record<string, unknown>): number | null => {
  for (const [key, value] of Object.entries(entry)) {
    const lowered = key.toLowerCase();
    if (
      lowered.includes("percent") ||
      lowered.includes("percentage") ||
      lowered.includes("share")
    ) {
      const parsed = parseNumericString(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
};

const findQuantityInEntry = (entry: Record<string, unknown>): bigint | null => {
  for (const [key, value] of Object.entries(entry)) {
    const lowered = key.toLowerCase();
    if (
      lowered.includes("quantity") ||
      lowered.includes("balance") ||
      lowered.includes("amount") ||
      lowered.includes("value")
    ) {
      const parsed = parseBigIntString(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
};

const getTokenSupply = async (
  chain: Chain,
  address: string,
  apiKey: string
): Promise<{ value?: bigint; error?: ExplorerError }> => {
  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", CHAIN_IDS[chain].toString());
  url.searchParams.set("module", "stats");
  url.searchParams.set("action", "tokensupply");
  url.searchParams.set("contractaddress", address);
  url.searchParams.set("apikey", apiKey);

  const response = await fetchJsonWithTimeout(url.toString());
  if (response.error) {
    return { error: response.error };
  }

  const parsed = parseEtherscanResult(response.data);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const supplyValue = parseBigIntString(parsed.result);
  if (supplyValue === null) {
    return {
      error: {
        code: "upstream_error",
        message: "Explorer returned an invalid total supply.",
        upstream: "etherscan",
      },
    };
  }

  return { value: supplyValue };
};

const getHolderFacts = async (
  chain: Chain,
  address: string,
  apiKey?: string
): Promise<ExplorerResult<HolderFacts>> => {
  if (!apiKey) {
    return { data: { ...unknownHolderFacts }, error: createMissingKeyError() };
  }

  if (!(chain in CHAIN_IDS)) {
    return { data: { ...unknownHolderFacts }, error: createUnsupportedChainError() };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", CHAIN_IDS[chain].toString());
  url.searchParams.set("module", "token");
  url.searchParams.set("action", "tokenholderlist");
  url.searchParams.set("contractaddress", address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "10");
  url.searchParams.set("apikey", apiKey);

  const response = await fetchJsonWithTimeout(url.toString());
  if (response.error) {
    return { data: { ...unknownHolderFacts }, error: response.error };
  }

  const parsed = parseEtherscanResult(response.data);
  if (parsed.error) {
    return { data: { ...unknownHolderFacts }, error: parsed.error };
  }

  if (!Array.isArray(parsed.result) || parsed.result.length === 0) {
    return {
      data: { ...unknownHolderFacts },
      error: {
        code: "upstream_error",
        message: "Explorer returned an empty holder list.",
        upstream: "etherscan",
      },
    };
  }

  const entries = parsed.result.slice(0, 10).filter(
    (entry): entry is Record<string, unknown> =>
      entry !== null && typeof entry === "object"
  );

  if (entries.length < 10) {
    return {
      data: { ...unknownHolderFacts, holderListAvailable: true },
      error: {
        code: "upstream_error",
        message: "Explorer returned fewer than 10 holders.",
        upstream: "etherscan",
      },
    };
  }

  let totalSupply: bigint | null = null;
  const percents: number[] = [];

  for (const entry of entries) {
    const percent = findPercentInEntry(entry);
    if (percent !== null) {
      percents.push(percent);
      continue;
    }

    if (totalSupply === null) {
      const supplyResponse = await getTokenSupply(chain, address, apiKey);
      if (supplyResponse.error) {
        return {
          data: { ...unknownHolderFacts, holderListAvailable: true },
          error: supplyResponse.error,
        };
      }
      totalSupply = supplyResponse.value ?? null;
      if (!totalSupply || totalSupply <= 0n) {
        return {
          data: { ...unknownHolderFacts, holderListAvailable: true },
          error: {
            code: "upstream_error",
            message: "Explorer returned an invalid total supply.",
            upstream: "etherscan",
          },
        };
      }
    }

    const quantity = findQuantityInEntry(entry);
    if (!quantity || totalSupply <= 0n) {
      return {
        data: { ...unknownHolderFacts, holderListAvailable: true },
        error: {
          code: "upstream_error",
          message: "Explorer holder list did not include balances.",
          upstream: "etherscan",
        },
      };
    }

    const percentScaled = (quantity * 10000n) / totalSupply;
    percents.push(Number(percentScaled) / 100);
  }

  if (percents.length < 10) {
    return {
      data: { ...unknownHolderFacts, holderListAvailable: true },
      error: {
        code: "upstream_error",
        message: "Explorer holder list did not include percentage data.",
        upstream: "etherscan",
      },
    };
  }

  return {
    data: {
      holderListAvailable: true,
      topHolderPercents: percents.slice(0, 10),
    },
  };
};

export const fetchExplorerFacts = async (
  chain: Chain,
  address: string,
  apiKey?: string
): Promise<ExplorerFacts> => {
  const [source, creation, holders] = await Promise.all([
    getContractSourceFacts(chain, address, apiKey),
    getContractCreationFacts(chain, address, apiKey),
    getHolderFacts(chain, address, apiKey),
  ]);

  return {
    source,
    creation,
    holders,
  };
};
