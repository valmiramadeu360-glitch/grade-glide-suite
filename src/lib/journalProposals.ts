export interface ProposalStatus { status: string }

/** A refusal closes one proposal; it never consumes a pending proposal slot. */
export function canSubmitJournalProposal(proposals: readonly ProposalStatus[]) {
  return proposals.filter((proposal) => proposal.status === "pending").length < 2;
}

export function splitJournalProposals<T extends ProposalStatus>(proposals: readonly T[]) {
  return {
    current: proposals.filter((proposal) => proposal.status !== "rejected"),
    rejected: proposals.filter((proposal) => proposal.status === "rejected"),
  };
}