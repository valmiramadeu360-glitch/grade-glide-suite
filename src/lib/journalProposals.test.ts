import { describe, expect, it } from "vitest";
import { canSubmitJournalProposal, splitJournalProposals } from "./journalProposals";

describe("journal proposal decisions", () => {
  it("allows a student or group to submit again after a refusal", () => {
    expect(canSubmitJournalProposal([{ status: "rejected" }])).toBe(true);
  });
  it("does not count refused proposals toward the existing two pending slots", () => {
    expect(canSubmitJournalProposal([{ status: "pending" }, { status: "rejected" }, { status: "rejected" }])).toBe(true);
    expect(canSubmitJournalProposal([{ status: "pending" }, { status: "pending" }, { status: "rejected" }])).toBe(false);
  });
  it("preserves the initial refusal separately from the new pending proposal", () => {
    const original = { id: "initial", status: "rejected", review_note: "Revisar fontes" };
    const replacement = { id: "new", status: "pending" };
    expect(splitJournalProposals([original, replacement])).toEqual({ current: [replacement], rejected: [original] });
  });
});