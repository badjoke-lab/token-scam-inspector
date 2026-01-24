import type { Chain } from "../explorer/types";

const DEFAULT_TIMEOUT_MS = 4000;

type RpcErrorCode =
  | "missing_rpc_url"
  | "timeout"
  | "rate_limited"
  | "upstream_error"
  | "invalid_response"
  | "reverted";

export type RpcError = {
  code: RpcErrorCode;
  message: string;
  status?: number;
};

type RpcSuccess = {
  ok: true;
  result: string;
};

type RpcFailure = {
  ok: false;
  error: RpcError;
};

export type RpcCallResult = RpcSuccess | RpcFailure;

type RpcEnv = {
  ETH_RPC_URL?: string;
  BSC_RPC_URL?: string;
};

const CHAIN_RPC_ENV_KEY: Record<Chain, keyof RpcEnv> = {
  eth: "ETH_RPC_URL",
  bsc: "BSC_RPC_URL",
};

const classifyRpcError = (status: number, message: string): RpcError => {
  const lowered = message.toLowerCase();
  if (status === 429 || lowered.includes("rate limit")) {
    return {
      code: "rate_limited",
      message: "RPC rate limit reached.",
      status,
    };
  }

  if (lowered.includes("revert")) {
    return {
      code: "reverted",
      message: "RPC call reverted.",
      status,
    };
  }

  return {
    code: "upstream_error",
    message: `RPC responded with status ${status}.`,
    status,
  };
};

const normalizeRpcPayloadError = (payload: unknown): RpcError => {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return {
      code: "invalid_response",
      message: "RPC response is missing error details.",
    };
  }

  const errorPayload = (
    payload as { error?: { message?: unknown; code?: unknown } }
  ).error;
  const message =
    typeof errorPayload?.message === "string"
      ? errorPayload.message
      : "RPC error.";
  const lowered = message.toLowerCase();

  if (lowered.includes("rate limit")) {
    return {
      code: "rate_limited",
      message: "RPC rate limit reached.",
    };
  }

  if (lowered.includes("revert")) {
    return {
      code: "reverted",
      message: "RPC call reverted.",
    };
  }

  return {
    code: "upstream_error",
    message,
  };
};

const normalizeRpcResult = (payload: unknown): RpcCallResult => {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "RPC response is not an object.",
      },
    };
  }

  if ("error" in payload) {
    return { ok: false, error: normalizeRpcPayloadError(payload) };
  }

  const result = (payload as { result?: unknown }).result;
  if (typeof result !== "string") {
    return {
      ok: false,
      error: {
        code: "invalid_response",
        message: "RPC response is missing a hex result.",
      },
    };
  }

  return { ok: true, result };
};

const buildRpcRequest = (address: string, data: string): string =>
  JSON.stringify({
    id: 1,
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: address,
        data,
      },
      "latest",
    ],
  });

export const ethCall = async (
  chain: Chain,
  address: string,
  data: string,
  env: RpcEnv,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<RpcCallResult> => {
  const rpcUrl = env[CHAIN_RPC_ENV_KEY[chain]];
  if (!rpcUrl) {
    return {
      ok: false,
      error: {
        code: "missing_rpc_url",
        message: "RPC URL is not configured for this chain.",
      },
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: buildRpcRequest(address, data),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: classifyRpcError(response.status, response.statusText),
      };
    }

    const payload = await response.json().catch(() => null);
    const normalized = normalizeRpcResult(payload);
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: {
          code: "timeout",
          message: "RPC request timed out.",
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "upstream_error",
        message: "RPC request failed.",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};
