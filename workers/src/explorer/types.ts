export type Chain = "eth" | "bsc";

export type ExplorerErrorCode =
  | "missing_api_key"
  | "upstream_error"
  | "rate_limited"
  | "not_supported"
  | "timeout"
  | "unavailable_on_free_plan";

export type ExplorerUpstream = "etherscan";

export type ExplorerValue = boolean | "unknown";

export interface ExplorerError {
  code: ExplorerErrorCode;
  message: string;
  upstream?: ExplorerUpstream;
}

export interface ExplorerResult<T> {
  data: T;
  error?: ExplorerError;
}

export interface ContractSourceFacts {
  sourceAvailable: ExplorerValue;
  isProxy: ExplorerValue;
  sourceCode: string;
}

export interface ContractCreationFacts {
  creatorAddress: string | "unknown";
  creationTxHash: string | "unknown";
}

export interface HolderFacts {
  holderListAvailable: boolean | "unknown";
  topHolderPercents: number[];
}

export interface ExplorerFacts {
  source: ExplorerResult<ContractSourceFacts>;
  creation: ExplorerResult<ContractCreationFacts>;
  holders: ExplorerResult<HolderFacts>;
}
