import type { Chain } from "../explorer/types";
import {
  getCachedTokenIdentity,
  putCachedTokenIdentity,
} from "../cache/tokenIdentity";
import { decodeAbiString, decodeAbiUint8 } from "../utils/abi";
import { ethCall, type RpcError } from "./rpcClient";
import type {
  TokenIdentityResult,
  TokenIdentityStatus,
} from "./tokenIdentityTypes";

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
} as const;

const MAX_CONCURRENCY = 2;

type RpcEnv = {
  ETH_RPC_URL?: string;
  BSC_RPC_URL?: string;
};

type TokenFieldKey = keyof typeof SELECTORS;

type TokenFieldOutcome<T> = {
  key: TokenFieldKey;
  value: T | null;
  error?: RpcError | "decode_failed";
};

const formatErrorNote = (error: RpcError | "decode_failed"): string => {
  if (error === "decode_failed") {
    return "invalid_response";
  }

  switch (error.code) {
    case "missing_rpc_url":
      return "missing_rpc_url";
    case "timeout":
      return "timeout";
    case "rate_limited":
      return "rate_limited";
    case "reverted":
      return "revert";
    case "invalid_response":
      return "invalid_response";
    default:
      return "upstream_error";
  }
};

const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
};

const callStringField = async (
  chain: Chain,
  address: string,
  key: Extract<TokenFieldKey, "name" | "symbol">,
  env: RpcEnv
): Promise<TokenFieldOutcome<string>> => {
  const rpcResult = await ethCall(chain, address, SELECTORS[key], env);
  if (!rpcResult.ok) {
    return { key, value: null, error: rpcResult.error };
  }

  const decoded = decodeAbiString(rpcResult.result);
  if (!decoded) {
    return { key, value: null, error: "decode_failed" };
  }

  return { key, value: decoded };
};

const callDecimalsField = async (
  chain: Chain,
  address: string,
  env: RpcEnv
): Promise<TokenFieldOutcome<number>> => {
  const rpcResult = await ethCall(chain, address, SELECTORS.decimals, env);
  if (!rpcResult.ok) {
    return { key: "decimals", value: null, error: rpcResult.error };
  }

  const decoded = decodeAbiUint8(rpcResult.result);
  if (decoded === null) {
    return { key: "decimals", value: null, error: "decode_failed" };
  }

  return { key: "decimals", value: decoded };
};

const buildNotes = (
  outcomes: TokenFieldOutcome<unknown>[]
): string | undefined => {
  const failedKeys = outcomes.filter((outcome) => outcome.value === null);
  if (failedKeys.length === 0) {
    return undefined;
  }

  const uniqueNotes = Array.from(
    new Set(
      failedKeys.map((outcome) =>
        outcome.error
          ? `${outcome.key}:${formatErrorNote(outcome.error)}`
          : `${outcome.key}:unknown`
      )
    )
  );

  return uniqueNotes.join(", ");
};

const buildStatus = (
  name: string | null,
  symbol: string | null,
  decimals: number | null
): TokenIdentityStatus => {
  if (name && symbol && decimals !== null) {
    return "ok";
  }

  if (name || symbol || decimals !== null) {
    return "partial";
  }

  return "failed";
};

const buildTokenIdentity = (
  outcomes: TokenFieldOutcome<unknown>[]
): TokenIdentityResult => {
  const nameOutcome = outcomes.find((outcome) => outcome.key === "name") as
    | TokenFieldOutcome<string>
    | undefined;
  const symbolOutcome = outcomes.find((outcome) => outcome.key === "symbol") as
    | TokenFieldOutcome<string>
    | undefined;
  const decimalsOutcome = outcomes.find((outcome) => outcome.key === "decimals") as
    | TokenFieldOutcome<number>
    | undefined;

  const name = nameOutcome?.value ?? null;
  const symbol = symbolOutcome?.value ?? null;
  const decimals = decimalsOutcome?.value ?? null;
  const status = buildStatus(name, symbol, decimals);
  const notes = buildNotes(outcomes);

  return {
    name,
    symbol,
    decimals,
    evidence: {
      source: "rpc_eth_call",
      status,
      ...(notes ? { notes } : {}),
    },
  };
};

export const fetchTokenIdentity = async (
  cache: Cache,
  origin: string,
  chain: Chain,
  address: string,
  env: RpcEnv
): Promise<TokenIdentityResult> => {
  const cached = await getCachedTokenIdentity(cache, origin, chain, address);
  if (cached) {
    return cached;
  }

  const tasks: Array<() => Promise<TokenFieldOutcome<unknown>>> = [
    () => callStringField(chain, address, "name", env),
    () => callStringField(chain, address, "symbol", env),
    () => callDecimalsField(chain, address, env),
  ];

  const outcomes = await runWithConcurrency(tasks, MAX_CONCURRENCY);
  const tokenIdentity = buildTokenIdentity(outcomes);

  try {
    await putCachedTokenIdentity(cache, origin, chain, address, tokenIdentity);
  } catch (error) {
    // Cache writes are best-effort; ignore failures.
  }

  return tokenIdentity;
};
