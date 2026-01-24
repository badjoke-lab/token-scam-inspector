export type TokenIdentityStatus = "ok" | "partial" | "failed";

export type TokenIdentityEvidence = {
  source: "rpc_eth_call";
  status: TokenIdentityStatus;
  notes?: string;
};

export type TokenIdentityResult = {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  evidence: TokenIdentityEvidence;
};
