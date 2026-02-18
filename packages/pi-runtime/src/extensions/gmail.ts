import type {
  GmailReadThreadContextRequest,
  GmailReadThreadContextResult,
  GmailSaveDraftRequest,
  GmailSaveDraftResult,
} from "../contracts";
import { EXTENSION_NAMES } from "../contracts";
import { deterministicHash } from "../hash";

export async function gmailReadThreadContext(
  request: GmailReadThreadContextRequest
): Promise<GmailReadThreadContextResult> {
  return {
    name: EXTENSION_NAMES.gmailReadThreadContext,
    status: "executed",
    idempotencyKey: request.idempotencyKey,
    output: {
      threadId: request.input.threadId,
      contextPreview: `Thread context for ${request.input.threadId}`,
    },
    executedAt: new Date().toISOString(),
  };
}

export async function gmailSaveDraft(
  request: GmailSaveDraftRequest
): Promise<GmailSaveDraftResult> {
  return {
    name: EXTENSION_NAMES.gmailSaveDraft,
    status: "executed",
    idempotencyKey: request.idempotencyKey,
    output: {
      providerDraftId: `draft_${deterministicHash(request.idempotencyKey)}`,
      subject: request.input.subject,
    },
    executedAt: new Date().toISOString(),
  };
}
