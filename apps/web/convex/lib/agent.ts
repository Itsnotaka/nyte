import type { RuntimePromptPart, RuntimeRetrievalHit } from "@nyte/domain";
import {
  interpretCommandTurn,
  type RuntimeCommandProposal,
  type RuntimeConversationTurn,
} from "@nyte/extension-runtime";

export async function buildRuntimeProposal(args: {
  message: string;
  parts: RuntimePromptPart[];
  retrievalHits: RuntimeRetrievalHit[];
  conversation?: RuntimeConversationTurn[];
  previousProposal?: RuntimeCommandProposal;
}): Promise<RuntimeCommandProposal> {
  const turn = await interpretCommandTurn({
    message: args.message,
    parts: args.parts,
    retrievalHits: args.retrievalHits,
    conversation: args.conversation ?? [
      {
        role: "user",
        text: args.message,
        createdAt: Date.now(),
      },
    ],
    previousProposal: args.previousProposal,
  });
  return turn.proposal;
}
