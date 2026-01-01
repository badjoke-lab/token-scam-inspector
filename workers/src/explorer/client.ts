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
};

const unknownCreationFacts: ContractCreationFacts = {
  creatorAddress: "unknown",
  creationTxHash: "unknown",
};

const unknownHolderFacts: HolderFacts = {
  holderListAvailable: "unknown",
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

const getHolderFacts = (): ExplorerResult<HolderFacts> => ({
  data: { ...unknownHolderFacts },
  error: {
    code: "unavailable_on_free_plan",
    message: "Explorer holder list is unavailable on the free plan.",
    upstream: "etherscan",
  },
});

export const fetchExplorerFacts = async (
  chain: Chain,
  address: string,
  apiKey?: string
): Promise<ExplorerFacts> => {
  const [source, creation] = await Promise.all([
    getContractSourceFacts(chain, address, apiKey),
    getContractCreationFacts(chain, address, apiKey),
  ]);

  return {
    source,
    creation,
    holders: getHolderFacts(),
  };
};
