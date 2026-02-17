import type { PiExtensionRequest, PiExtensionResult } from "./contracts";
import { piExtensionRegistry } from "./registry";

export async function executePiExtension<TRequest extends PiExtensionRequest>(
  request: TRequest,
): Promise<PiExtensionResult> {
  const extension = piExtensionRegistry[request.name];
  return extension(request as never);
}
