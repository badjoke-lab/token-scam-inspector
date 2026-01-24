import type { ExplorerError, ExplorerFacts } from "../explorer/types";

export type InputErrorCode =
  | "missing_params"
  | "invalid_chain"
  | "invalid_address";

export type UpstreamErrorCode =
  | "missing_api_key"
  | "rate_limited"
  | "upstream_error"
  | "invalid_response";

export type InspectErrorCode = InputErrorCode | UpstreamErrorCode;

export type ErrorDetail = {
  provider?: string;
  hint?: string;
  status?: number;
};

export type InspectError = {
  code: InspectErrorCode;
  message: string;
  detail?: ErrorDetail;
  status: number;
};

export class InspectRouteError extends Error {
  readonly inspectError: InspectError;

  constructor(inspectError: InspectError) {
    super(inspectError.message);
    this.inspectError = inspectError;
  }
}

const INVALID_RESPONSE_KEYWORDS = ["invalid", "parse", "schema", "json"];

const mapExplorerError = (error: ExplorerError): InspectError => {
  const provider = error.upstream;
  const detail: ErrorDetail | undefined = provider
    ? { provider }
    : undefined;

  if (error.code === "missing_api_key") {
    return {
      code: "missing_api_key",
      message: "Upstream API key is missing or rejected.",
      detail,
      status: 503,
    };
  }

  if (error.code === "rate_limited") {
    return {
      code: "rate_limited",
      message: "Upstream provider rate limit reached.",
      detail: { ...detail, hint: "Please try again later." },
      status: 429,
    };
  }

  const loweredMessage = error.message.toLowerCase();
  const isInvalidResponse = INVALID_RESPONSE_KEYWORDS.some((keyword) =>
    loweredMessage.includes(keyword)
  );

  if (isInvalidResponse) {
    return {
      code: "invalid_response",
      message: "Upstream returned an invalid response.",
      detail,
      status: 502,
    };
  }

  return {
    code: "upstream_error",
    message: "Upstream request failed.",
    detail,
    status: error.code === "timeout" ? 504 : 502,
  };
};

const BLOCKING_UPSTREAM_CODES = new Set([
  "missing_api_key",
  "rate_limited",
  "upstream_error",
  "timeout",
]);

export const getBlockingUpstreamError = (
  explorerFacts: ExplorerFacts
): InspectError | null => {
  const errors = [
    explorerFacts.source.error,
    explorerFacts.creation.error,
    explorerFacts.holders.error,
  ].filter((error): error is ExplorerError => Boolean(error));

  const blockingError = errors.find((error) =>
    BLOCKING_UPSTREAM_CODES.has(error.code)
  );

  if (!blockingError) {
    return null;
  }

  return mapExplorerError(blockingError);
};
