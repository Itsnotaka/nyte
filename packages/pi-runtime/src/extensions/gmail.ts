import type {
  GmailSendRequest,
  GmailSendResult,
  GmailReadThreadContextRequest,
  GmailReadThreadContextResult,
} from "../contracts";
import { EXTENSION_NAMES } from "../contracts";

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

export async function gmailSend(
  request: GmailSendRequest
): Promise<GmailSendResult> {
  return {
    name: EXTENSION_NAMES.gmailSend,
    status: "executed",
    idempotencyKey: request.idempotencyKey,
    output: {
      providerMessageId: `msg_${request.idempotencyKey}`,
      subject: request.input.subject,
      recipients: request.input.to,
    },
    executedAt: new Date().toISOString(),
  };
}
