# iMessage Integration Deep Research + Full TypeScript Replication Guide

This guide reverse-engineers iMessage support from:

- `openagen/zeroclaw` (Rust channel implementation)
- `openclaw/openclaw` (TypeScript plugin + gateway implementation)

and gives you a full TypeScript implementation blueprint (with complete code
blocks) to replicate the behavior, including a distributed mode.

---

## 1) What these two projects actually do

### 1.1 ZeroClaw (`openagen/zeroclaw`)

Key files:

- `src/channels/imessage.rs`
- `src/config/schema.rs`
- `src/channels/mod.rs`
- `src/onboard/wizard.rs`

Behavior:

1. **Send**: uses `osascript` + AppleScript
   (`tell application "Messages" ... send ...`) to send messages.
2. **Receive**: polls `~/Library/Messages/chat.db` every ~3s with SQLite query:
   - `message.ROWID > last_rowid`
   - `is_from_me = 0`
   - `text IS NOT NULL`
3. **Allowlist**: `allowed_contacts` (or `*`).
4. **Security hardening**:
   - AppleScript string escaping (`\\`, `\"`, `\n`, `\r`)
   - target validation (phone/email format) before interpolation
   - parameterized SQL query
5. **macOS requirements**: Messages configured + Full Disk Access.

This is a direct/native integration path with no external iMessage daemon.

### 1.2 OpenClaw (`openclaw/openclaw`)

Key files:

- `src/imessage/client.ts`
- `src/imessage/send.ts`
- `src/imessage/monitor/monitor-provider.ts`
- `src/imessage/monitor/inbound-processing.ts`
- `src/imessage/monitor/parse-notification.ts`
- `src/imessage/targets.ts`
- `src/config/types.imessage.ts`
- `src/config/zod-schema.providers-core.ts`
- `extensions/imessage/src/channel.ts`
- docs: `docs/channels/imessage.md`

Behavior:

1. **Primary transport**: spawns `imsg rpc` and speaks JSON-RPC on stdio.
2. **Receive**: subscribes with `watch.subscribe`, consumes `message`
   notifications.
3. **Send**: `send` RPC with rich targeting:
   - `chat_id:*`, `chat_guid:*`, `chat_identifier:*`, handle/email/phone.
4. **Policies**:
   - DM: `pairing | allowlist | open | disabled`
   - Group: `allowlist | open | disabled`
   - mention gating in groups
   - control-command authorization checks
5. **Safety**:
   - executable path safety (`ExecutableTokenSchema` + `isSafeExecutableValue`)
   - reply tag sanitization (`[[reply_to:...]]`)
   - malformed payload dropping
   - echo suppression cache
6. **Distributed-friendly features**:
   - `cliPath` can be an SSH wrapper
   - `remoteHost` + SCP for remote attachment paths
7. **Status**: marked legacy in docs; BlueBubbles preferred for new setups.

---

## 2) Replication target architecture (TypeScript)

To replicate both approaches cleanly:

1. **macOS bridge runtime** (must run on a Mac with Messages access)
   - primary mode: `imsg rpc`
   - fallback mode: `chat.db` poll + AppleScript send
2. **policy engine**
   - DM/group policy, pairing, mention gating, allowlists
3. **agent/gateway integration**
   - receive normalized inbound events
   - send outbound text/media/replies
4. **distributed mode**
   - macOS bridge exposes authenticated WebSocket API
   - remote gateway/AI worker connects and controls send/receive

---

## 3) Full TypeScript implementation

## 3.1 Project structure

```text
imessage-agent/
  package.json
  tsconfig.json
  src/
    types.ts
    security.ts
    targets.ts
    config.ts
    imsg-rpc-client.ts
    chatdb.ts
    send.ts
    inbound-policy.ts
    monitor.ts
    distributed/
      mac-bridge.ts
      gateway-client.ts
    index.ts
```

## 3.2 `package.json`

```json
{
  "name": "imessage-agent",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "ws": "^8.18.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^24.3.0",
    "@types/ws": "^8.5.13",
    "tsx": "^4.20.3",
    "typescript": "^5.9.2"
  }
}
```

## 3.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

## 3.4 `src/types.ts`

```ts
export type IMessageService = "imessage" | "sms" | "auto";
export type DmPolicy = "pairing" | "allowlist" | "open" | "disabled";
export type GroupPolicy = "allowlist" | "open" | "disabled";

export type IMessageTarget =
  | { kind: "chat_id"; chatId: number }
  | { kind: "chat_guid"; chatGuid: string }
  | { kind: "chat_identifier"; chatIdentifier: string }
  | { kind: "handle"; to: string; service: IMessageService };

export type IMessageAttachment = {
  original_path?: string | null;
  mime_type?: string | null;
  missing?: boolean | null;
};

export type IMessageInboundPayload = {
  id?: number | null;
  chat_id?: number | null;
  chat_guid?: string | null;
  chat_identifier?: string | null;
  chat_name?: string | null;
  participants?: string[] | null;
  sender?: string | null;
  is_from_me?: boolean | null;
  is_group?: boolean | null;
  text?: string | null;
  created_at?: string | null;
  reply_to_id?: string | number | null;
  reply_to_text?: string | null;
  reply_to_sender?: string | null;
  attachments?: IMessageAttachment[] | null;
};

export type IMessageConfig = {
  enabled?: boolean;
  mode?: "imsg" | "chatdb" | "auto";
  cliPath?: string;
  dbPath?: string;
  remoteHost?: string;
  service?: IMessageService;
  region?: string;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  includeAttachments?: boolean;
  mediaMaxMb?: number;
  textChunkLimit?: number;
  chunkMode?: "length" | "newline";
  pollIntervalMs?: number;
  requireMention?: boolean;
  mentionPatterns?: string[];
  groups?: Record<string, { requireMention?: boolean }>;
  pairing?: { enabled?: boolean; ttlSeconds?: number };
};

export type InboundDecision =
  | { kind: "drop"; reason: string }
  | { kind: "pairing"; senderId: string }
  | {
      kind: "dispatch";
      isGroup: boolean;
      sender: string;
      senderNormalized: string;
      body: string;
      to: string;
      chatId?: number;
      createdAt?: number;
      replyTo?: { id?: string; body?: string; sender?: string };
    };
```

## 3.5 `src/security.ts`

```ts
const SHELL_METACHARS = /[;&|`$<>]/;
const CONTROL_CHARS = /[\r\n]/;
const QUOTE_CHARS = /["']/;
const BARE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;

function isLikelyPath(value: string): boolean {
  if (value.startsWith(".") || value.startsWith("~")) return true;
  if (value.includes("/") || value.includes("\\")) return true;
  return /^[A-Za-z]:[\\/]/.test(value);
}

export function isSafeExecutableValue(
  value: string | null | undefined
): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("\0")) return false;
  if (CONTROL_CHARS.test(trimmed)) return false;
  if (SHELL_METACHARS.test(trimmed)) return false;
  if (QUOTE_CHARS.test(trimmed)) return false;
  if (isLikelyPath(trimmed)) return true;
  if (trimmed.startsWith("-")) return false;
  return BARE_NAME_PATTERN.test(trimmed);
}

export function escapeAppleScript(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

export function isValidIMessageTarget(target: string): boolean {
  const v = target.trim();
  if (!v) return false;

  if (v.startsWith("+")) {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  const at = v.indexOf("@");
  if (at <= 0 || at === v.length - 1) return false;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (!/^[A-Za-z0-9._+-]+$/.test(local)) return false;
  if (!domain.includes(".")) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  return true;
}

const LEADING_REPLY_TAG_RE = /^\s*\[\[\s*reply_to\s*:\s*([^\]\n]+)\s*\]\]\s*/i;

function stripUnsafeReplyTagChars(value: string): string {
  let next = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if ((code >= 0 && code <= 31) || code === 127 || ch === "[" || ch === "]")
      continue;
    next += ch;
  }
  return next;
}

export function sanitizeReplyToId(rawReplyToId?: string): string | undefined {
  const trimmed = rawReplyToId?.trim();
  if (!trimmed) return undefined;
  const sanitized = stripUnsafeReplyTagChars(trimmed).trim();
  if (!sanitized) return undefined;
  return sanitized.slice(0, 256);
}

export function prependReplyTagIfNeeded(
  message: string,
  replyToId?: string
): string {
  const resolvedReplyToId = sanitizeReplyToId(replyToId);
  if (!resolvedReplyToId) return message;

  const replyTag = `[[reply_to:${resolvedReplyToId}]]`;
  const existingLeadingTag = message.match(LEADING_REPLY_TAG_RE);
  if (existingLeadingTag) {
    const remainder = message.slice(existingLeadingTag[0].length).trimStart();
    return remainder ? `${replyTag} ${remainder}` : replyTag;
  }

  const trimmedMessage = message.trimStart();
  return trimmedMessage ? `${replyTag} ${trimmedMessage}` : replyTag;
}
```

## 3.6 `src/targets.ts`

```ts
import type { IMessageService, IMessageTarget } from "./types.js";

const CHAT_ID_PREFIXES = ["chat_id:", "chatid:", "chat:"];
const CHAT_GUID_PREFIXES = ["chat_guid:", "chatguid:", "guid:"];
const CHAT_IDENTIFIER_PREFIXES = [
  "chat_identifier:",
  "chatidentifier:",
  "chatident:",
];

function normalizeE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (!trimmed.startsWith("+")) return null;
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

export function normalizeIMessageHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith("imessage:"))
    return normalizeIMessageHandle(trimmed.slice(9));
  if (lowered.startsWith("sms:"))
    return normalizeIMessageHandle(trimmed.slice(4));
  if (lowered.startsWith("auto:"))
    return normalizeIMessageHandle(trimmed.slice(5));

  for (const prefix of CHAT_ID_PREFIXES) {
    if (lowered.startsWith(prefix))
      return `chat_id:${trimmed.slice(prefix.length).trim()}`;
  }
  for (const prefix of CHAT_GUID_PREFIXES) {
    if (lowered.startsWith(prefix))
      return `chat_guid:${trimmed.slice(prefix.length).trim()}`;
  }
  for (const prefix of CHAT_IDENTIFIER_PREFIXES) {
    if (lowered.startsWith(prefix)) {
      return `chat_identifier:${trimmed.slice(prefix.length).trim()}`;
    }
  }

  if (trimmed.includes("@")) return trimmed.toLowerCase();
  return normalizeE164(trimmed) ?? trimmed.replace(/\s+/g, "");
}

function parseChatTarget(
  lower: string,
  trimmed: string
): IMessageTarget | null {
  for (const prefix of CHAT_ID_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const n = Number(trimmed.slice(prefix.length).trim());
      if (!Number.isFinite(n))
        throw new Error(`Invalid chat_id target: ${trimmed}`);
      return { kind: "chat_id", chatId: n };
    }
  }
  for (const prefix of CHAT_GUID_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const v = trimmed.slice(prefix.length).trim();
      if (!v) throw new Error(`Invalid chat_guid target: ${trimmed}`);
      return { kind: "chat_guid", chatGuid: v };
    }
  }
  for (const prefix of CHAT_IDENTIFIER_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const v = trimmed.slice(prefix.length).trim();
      if (!v) throw new Error(`Invalid chat_identifier target: ${trimmed}`);
      return { kind: "chat_identifier", chatIdentifier: v };
    }
  }
  return null;
}

export function parseIMessageTarget(raw: string): IMessageTarget {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("iMessage target is required");
  const lower = trimmed.toLowerCase();

  const servicePrefixes: Array<{ prefix: string; service: IMessageService }> = [
    { prefix: "imessage:", service: "imessage" },
    { prefix: "sms:", service: "sms" },
    { prefix: "auto:", service: "auto" },
  ];

  for (const sp of servicePrefixes) {
    if (lower.startsWith(sp.prefix)) {
      const remainder = trimmed.slice(sp.prefix.length).trim();
      const remainderLower = remainder.toLowerCase();
      const chatTarget = parseChatTarget(remainderLower, remainder);
      if (chatTarget) return chatTarget;
      if (!remainder) throw new Error(`Invalid iMessage target: ${raw}`);
      return { kind: "handle", to: remainder, service: sp.service };
    }
  }

  const chatTarget = parseChatTarget(lower, trimmed);
  if (chatTarget) return chatTarget;
  return { kind: "handle", to: trimmed, service: "auto" };
}

export function formatIMessageChatTarget(chatId?: number | null): string {
  if (!chatId || !Number.isFinite(chatId)) return "";
  return `chat_id:${chatId}`;
}

export function isAllowedIMessageSender(params: {
  allowFrom: Array<string | number>;
  sender: string;
  chatId?: number | null;
  chatGuid?: string | null;
  chatIdentifier?: string | null;
}): boolean {
  const senderNorm = normalizeIMessageHandle(params.sender);

  for (const raw of params.allowFrom) {
    const v = String(raw).trim();
    if (!v) continue;
    if (v === "*") return true;

    const lower = v.toLowerCase();
    if (lower.startsWith("chat_id:")) {
      const n = Number(v.slice("chat_id:".length).trim());
      if (Number.isFinite(n) && params.chatId === n) return true;
      continue;
    }
    if (lower.startsWith("chat_guid:")) {
      const id = v.slice("chat_guid:".length).trim();
      if (id && params.chatGuid && id === params.chatGuid) return true;
      continue;
    }
    if (lower.startsWith("chat_identifier:")) {
      const id = v.slice("chat_identifier:".length).trim();
      if (id && params.chatIdentifier && id === params.chatIdentifier)
        return true;
      continue;
    }

    if (normalizeIMessageHandle(v) === senderNorm) return true;
  }

  return false;
}
```

## 3.7 `src/config.ts`

```ts
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { isSafeExecutableValue } from "./security.js";

export const IMessageConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    mode: z.enum(["imsg", "chatdb", "auto"]).optional().default("auto"),
    cliPath: z
      .string()
      .refine(isSafeExecutableValue, "expected safe executable name or path")
      .optional(),
    dbPath: z.string().optional(),
    remoteHost: z.string().optional(),
    service: z.enum(["imessage", "sms", "auto"]).optional().default("auto"),
    region: z.string().optional().default("US"),
    dmPolicy: z
      .enum(["pairing", "allowlist", "open", "disabled"])
      .optional()
      .default("pairing"),
    groupPolicy: z
      .enum(["allowlist", "open", "disabled"])
      .optional()
      .default("allowlist"),
    allowFrom: z
      .array(z.union([z.string(), z.number()]))
      .optional()
      .default([]),
    groupAllowFrom: z
      .array(z.union([z.string(), z.number()]))
      .optional()
      .default([]),
    includeAttachments: z.boolean().optional().default(false),
    mediaMaxMb: z.number().int().positive().optional().default(16),
    textChunkLimit: z.number().int().positive().optional().default(4000),
    chunkMode: z.enum(["length", "newline"]).optional().default("length"),
    pollIntervalMs: z.number().int().positive().optional().default(3000),
    requireMention: z.boolean().optional().default(true),
    mentionPatterns: z.array(z.string()).optional().default([]),
    groups: z
      .record(z.string(), z.object({ requireMention: z.boolean().optional() }))
      .optional()
      .default({}),
    pairing: z
      .object({
        enabled: z.boolean().optional().default(true),
        ttlSeconds: z.number().int().positive().optional().default(3600),
      })
      .optional()
      .default({ enabled: true, ttlSeconds: 3600 }),
  })
  .superRefine((value, ctx) => {
    if (
      value.dmPolicy === "open" &&
      !value.allowFrom.some((v) => String(v).trim() === "*")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowFrom"],
        message: 'dmPolicy="open" requires allowFrom to include "*"',
      });
    }
  });

export type IMessageConfig = z.infer<typeof IMessageConfigSchema>;

export function defaultConfig(): IMessageConfig {
  return IMessageConfigSchema.parse({
    cliPath: "imsg",
    dbPath: join(homedir(), "Library/Messages/chat.db"),
  });
}
```

## 3.8 `src/imsg-rpc-client.ts`

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

export type IMessageRpcNotification = { method: string; params?: unknown };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer?: NodeJS.Timeout;
};

export class IMessageRpcClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private reader: Interface | null = null;
  private readonly pending = new Map<string, Pending>();
  private id = 1;
  private readonly closed: Promise<void>;
  private closedResolve!: () => void;

  constructor(
    private readonly opts: {
      cliPath: string;
      dbPath?: string;
      onNotification?: (n: IMessageRpcNotification) => void;
      onError?: (msg: string) => void;
    }
  ) {
    this.closed = new Promise<void>((resolve) => {
      this.closedResolve = resolve;
    });
  }

  async start(): Promise<void> {
    if (this.child) return;
    const args = ["rpc"];
    if (this.opts.dbPath?.trim()) args.push("--db", this.opts.dbPath.trim());

    const child = spawn(this.opts.cliPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    this.reader = createInterface({ input: child.stdout });

    this.reader.on("line", (line) => this.handleLine(line.trim()));
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) this.opts.onError?.(`imsg rpc: ${line.trim()}`);
      }
    });

    child.on("error", (err) => {
      this.failAll(err instanceof Error ? err : new Error(String(err)));
      this.closedResolve();
    });

    child.on("close", (code, signal) => {
      const reason = signal
        ? `signal ${signal}`
        : `code ${String(code ?? "null")}`;
      this.failAll(new Error(`imsg rpc closed (${reason})`));
      this.closedResolve();
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    this.reader?.close();
    this.reader = null;
    child.stdin.end();
    await Promise.race([
      this.closed,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (!child.killed) child.kill("SIGTERM");
          resolve();
        }, 500);
      }),
    ]);
  }

  async waitForClose(): Promise<void> {
    await this.closed;
  }

  async request<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 10_000
  ): Promise<T> {
    if (!this.child) throw new Error("imsg rpc not running");
    const id = this.id++;
    const payload = { jsonrpc: "2.0", id, method, params };

    const response = new Promise<T>((resolve, reject) => {
      const key = String(id);
      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.pending.delete(key);
              reject(new Error(`imsg rpc timeout (${method})`));
            }, timeoutMs)
          : undefined;
      this.pending.set(key, { resolve: (v) => resolve(v as T), reject, timer });
    });

    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    return await response;
  }

  private handleLine(line: string): void {
    if (!line) return;
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.opts.onError?.(`imsg rpc: invalid JSON: ${line}`);
      return;
    }

    if (parsed?.id !== undefined && parsed?.id !== null) {
      const key = String(parsed.id);
      const p = this.pending.get(key);
      if (!p) return;
      if (p.timer) clearTimeout(p.timer);
      this.pending.delete(key);

      if (parsed.error) {
        const msg = parsed.error?.message ?? "imsg rpc error";
        p.reject(new Error(msg));
        return;
      }

      p.resolve(parsed.result);
      return;
    }

    if (typeof parsed?.method === "string") {
      this.opts.onNotification?.({
        method: parsed.method,
        params: parsed.params,
      });
    }
  }

  private failAll(err: Error): void {
    for (const [key, p] of this.pending.entries()) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(key);
    }
  }
}
```

## 3.9 `src/chatdb.ts`

```ts
import Database from "better-sqlite3";
import type { IMessageInboundPayload } from "./types.js";

export type ChatDbRow = {
  rowid: number;
  sender: string;
  text: string;
};

export function openChatDb(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

export function getMaxInboundRowId(db: Database.Database): number {
  const row = db
    .prepare("SELECT MAX(ROWID) AS max_rowid FROM message WHERE is_from_me = 0")
    .get() as {
    max_rowid?: number | null;
  };
  return row.max_rowid ?? 0;
}

export function fetchNewInboundRows(
  db: Database.Database,
  sinceRowId: number,
  limit = 20
): ChatDbRow[] {
  const stmt = db.prepare(
    `SELECT m.ROWID AS rowid, h.id AS sender, m.text AS text
     FROM message m
     JOIN handle h ON m.handle_id = h.ROWID
     WHERE m.ROWID > ?
       AND m.is_from_me = 0
       AND m.text IS NOT NULL
     ORDER BY m.ROWID ASC
     LIMIT ?`
  );
  return stmt.all(sinceRowId, limit) as ChatDbRow[];
}

export function rowToInboundPayload(row: ChatDbRow): IMessageInboundPayload {
  return {
    id: row.rowid,
    sender: row.sender,
    text: row.text,
    is_from_me: false,
    is_group: false,
  };
}
```

## 3.10 `src/send.ts`

```ts
import { spawn } from "node:child_process";
import {
  escapeAppleScript,
  isValidIMessageTarget,
  prependReplyTagIfNeeded,
} from "./security.js";
import { IMessageRpcClient } from "./imsg-rpc-client.js";
import { parseIMessageTarget } from "./targets.js";
import type { IMessageService } from "./types.js";

function runAppleScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-e", script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`osascript failed (${String(code)}): ${stderr.trim()}`)
        );
    });
  });
}

export async function sendViaAppleScript(
  target: string,
  message: string
): Promise<void> {
  if (!isValidIMessageTarget(target)) {
    throw new Error("Invalid iMessage target for AppleScript fallback");
  }

  const escapedTarget = escapeAppleScript(target);
  const escapedMsg = escapeAppleScript(message);
  const script = `tell application "Messages"
  set targetService to 1st account whose service type = iMessage
  set targetBuddy to participant "${escapedTarget}" of targetService
  send "${escapedMsg}" to targetBuddy
end tell`;
  await runAppleScript(script);
}

function resolveMessageId(result: Record<string, unknown> | undefined): string {
  if (!result) return "unknown";
  const id =
    (typeof result.messageId === "string" && result.messageId.trim()) ||
    (typeof result.message_id === "string" && result.message_id.trim()) ||
    (typeof result.id === "string" && result.id.trim()) ||
    (typeof result.guid === "string" && result.guid.trim()) ||
    (typeof result.id === "number" ? String(result.id) : "") ||
    (typeof result.message_id === "number" ? String(result.message_id) : "");
  return id || "unknown";
}

export async function sendMessageIMessage(params: {
  cliPath?: string;
  dbPath?: string;
  to: string;
  text: string;
  service?: IMessageService;
  region?: string;
  replyToId?: string;
  mediaPath?: string;
  timeoutMs?: number;
  fallbackToAppleScript?: boolean;
  client?: IMessageRpcClient;
}): Promise<{ messageId: string }> {
  const target = parseIMessageTarget(params.to);
  const service =
    params.service ?? (target.kind === "handle" ? target.service : "auto");
  const region = params.region ?? "US";

  let message = prependReplyTagIfNeeded(params.text ?? "", params.replyToId);
  if (!message.trim() && !params.mediaPath) {
    throw new Error("iMessage send requires text or media");
  }

  const payload: Record<string, unknown> = { text: message, service, region };
  if (params.mediaPath) payload.file = params.mediaPath;

  if (target.kind === "chat_id") payload.chat_id = target.chatId;
  else if (target.kind === "chat_guid") payload.chat_guid = target.chatGuid;
  else if (target.kind === "chat_identifier")
    payload.chat_identifier = target.chatIdentifier;
  else payload.to = target.to;

  const client =
    params.client ??
    new IMessageRpcClient({
      cliPath: params.cliPath ?? "imsg",
      dbPath: params.dbPath,
    });
  const shouldStop = !params.client;

  try {
    if (!params.client) await client.start();
    const result = await client.request<Record<string, unknown>>(
      "send",
      payload,
      params.timeoutMs ?? 10_000
    );
    return { messageId: resolveMessageId(result) };
  } catch (err) {
    if (params.fallbackToAppleScript && target.kind === "handle") {
      await sendViaAppleScript(target.to, message);
      return { messageId: "apple-script-fallback" };
    }
    throw err;
  } finally {
    if (shouldStop) await client.stop();
  }
}
```

## 3.11 `src/inbound-policy.ts`

```ts
import type {
  IMessageConfig,
  IMessageInboundPayload,
  InboundDecision,
} from "./types.js";
import {
  formatIMessageChatTarget,
  isAllowedIMessageSender,
  normalizeIMessageHandle,
} from "./targets.js";

export type PairingStore = {
  hasApproved: (senderId: string) => Promise<boolean>;
  createRequest: (
    senderId: string
  ) => Promise<{ code: string; created: boolean }>;
};

export class InMemoryPairingStore implements PairingStore {
  private approved = new Set<string>();
  private pending = new Map<string, string>();

  approve(senderId: string): void {
    this.approved.add(senderId);
    this.pending.delete(senderId);
  }

  async hasApproved(senderId: string): Promise<boolean> {
    return this.approved.has(senderId);
  }

  async createRequest(
    senderId: string
  ): Promise<{ code: string; created: boolean }> {
    const existing = this.pending.get(senderId);
    if (existing) return { code: existing, created: false };
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    this.pending.set(senderId, code);
    return { code, created: true };
  }
}

function matchesMention(text: string, patterns: string[]): boolean {
  for (const p of patterns) {
    try {
      if (new RegExp(p, "i").test(text)) return true;
    } catch {
      if (text.toLowerCase().includes(p.toLowerCase())) return true;
    }
  }
  return false;
}

export async function resolveInboundDecision(params: {
  config: IMessageConfig;
  message: IMessageInboundPayload;
  pairingStore?: PairingStore;
  storeAllowFrom?: string[];
}): Promise<InboundDecision> {
  const { config, message } = params;
  const sender = (message.sender ?? "").trim();
  if (!sender) return { kind: "drop", reason: "missing sender" };
  if (message.is_from_me) return { kind: "drop", reason: "from me" };

  const body = (message.text ?? "").trim();
  if (!body) return { kind: "drop", reason: "empty body" };

  const senderNormalized = normalizeIMessageHandle(sender);
  const chatId = message.chat_id ?? undefined;
  const configuredGroups = config.groups ?? {};
  const treatAsGroupByConfig =
    chatId != null &&
    (configuredGroups[String(chatId)] || configuredGroups["*"]);
  const isGroup = Boolean(message.is_group) || Boolean(treatAsGroupByConfig);

  const allowFrom = [
    ...(config.allowFrom ?? []),
    ...(params.storeAllowFrom ?? []).map((v) => String(v)),
  ];
  const groupAllowFrom = config.groupAllowFrom ?? [];
  const dmPolicy = config.dmPolicy ?? "pairing";
  const groupPolicy = config.groupPolicy ?? "allowlist";

  const allowedByDm =
    dmPolicy === "open" ||
    isAllowedIMessageSender({
      allowFrom,
      sender,
      chatId,
      chatGuid: message.chat_guid,
      chatIdentifier: message.chat_identifier,
    });

  if (!isGroup) {
    if (dmPolicy === "disabled") return { kind: "drop", reason: "dm disabled" };

    if (!allowedByDm) {
      if (
        dmPolicy === "pairing" &&
        config.pairing?.enabled !== false &&
        params.pairingStore
      ) {
        const approved =
          await params.pairingStore.hasApproved(senderNormalized);
        if (!approved) {
          await params.pairingStore.createRequest(senderNormalized);
          return { kind: "pairing", senderId: senderNormalized };
        }
      }
      return { kind: "drop", reason: "dm not allowed" };
    }
  }

  if (isGroup) {
    if (groupPolicy === "disabled")
      return { kind: "drop", reason: "group disabled" };
    if (groupPolicy === "allowlist") {
      const allowed = isAllowedIMessageSender({
        allowFrom: groupAllowFrom,
        sender,
        chatId,
        chatGuid: message.chat_guid,
        chatIdentifier: message.chat_identifier,
      });
      if (!allowed) return { kind: "drop", reason: "group allowlist blocked" };
    }

    const groupCfg =
      (chatId != null ? configuredGroups[String(chatId)] : undefined) ??
      configuredGroups["*"];
    const requireMention =
      groupCfg?.requireMention ?? config.requireMention ?? true;
    const patterns = config.mentionPatterns ?? [];
    if (
      requireMention &&
      patterns.length > 0 &&
      !matchesMention(body, patterns)
    ) {
      return { kind: "drop", reason: "mention required" };
    }
  }

  const to = isGroup ? formatIMessageChatTarget(chatId) : `imessage:${sender}`;
  return {
    kind: "dispatch",
    isGroup,
    sender,
    senderNormalized,
    body,
    to,
    chatId,
    createdAt: message.created_at ? Date.parse(message.created_at) : undefined,
    replyTo: {
      id: message.reply_to_id != null ? String(message.reply_to_id) : undefined,
      body: message.reply_to_text ?? undefined,
      sender: message.reply_to_sender ?? undefined,
    },
  };
}
```

## 3.12 `src/monitor.ts`

```ts
import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";
import {
  fetchNewInboundRows,
  getMaxInboundRowId,
  openChatDb,
  rowToInboundPayload,
} from "./chatdb.js";
import { IMessageRpcClient } from "./imsg-rpc-client.js";
import { resolveInboundDecision, type PairingStore } from "./inbound-policy.js";
import { sendMessageIMessage } from "./send.js";
import type { IMessageConfig, IMessageInboundPayload } from "./types.js";

export type MonitorEvents = {
  dispatch: (payload: {
    to: string;
    text: string;
    raw: IMessageInboundPayload;
  }) => void;
  pairing: (payload: { senderId: string; raw: IMessageInboundPayload }) => void;
  error: (err: Error) => void;
};

export class IMessageMonitor extends EventEmitter {
  private rpcClient: IMessageRpcClient | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private db: ReturnType<typeof openChatDb> | null = null;
  private lastRowId = 0;
  private running = false;

  constructor(
    private readonly config: IMessageConfig,
    private readonly pairingStore?: PairingStore
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const mode = this.config.mode ?? "auto";
    if (mode === "imsg" || mode === "auto") {
      try {
        await this.startImsgWatch();
        return;
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
        if (mode === "imsg") throw err;
      }
    }

    await this.startChatDbPoll();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.rpcClient) {
      await this.rpcClient.stop();
      this.rpcClient = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async startImsgWatch(): Promise<void> {
    const cliPath = this.config.cliPath ?? "imsg";
    this.rpcClient = new IMessageRpcClient({
      cliPath,
      dbPath: this.config.dbPath,
      onNotification: (msg) => {
        if (msg.method === "message") {
          void this.handleRawInbound(msg.params);
        }
      },
      onError: (m) => this.emit("error", new Error(m)),
    });

    await this.rpcClient.start();
    await this.rpcClient.request("watch.subscribe", {
      attachments: this.config.includeAttachments ?? false,
    });

    void this.rpcClient.waitForClose().catch((err) => {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    });
  }

  private async startChatDbPoll(): Promise<void> {
    const dbPath = this.config.dbPath;
    if (!dbPath || !existsSync(dbPath)) {
      throw new Error(`Messages database not found: ${dbPath ?? "<unset>"}`);
    }

    this.db = openChatDb(dbPath);
    this.lastRowId = getMaxInboundRowId(this.db);
    const interval = this.config.pollIntervalMs ?? 3000;

    this.pollTimer = setInterval(() => {
      if (!this.db || !this.running) return;
      try {
        const rows = fetchNewInboundRows(this.db, this.lastRowId, 20);
        for (const row of rows) {
          this.lastRowId = Math.max(this.lastRowId, row.rowid);
          void this.handleInbound(rowToInboundPayload(row));
        }
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
      }
    }, interval);
  }

  private async handleRawInbound(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== "object") return;
    const messageObj = (raw as { message?: unknown }).message;
    if (!messageObj || typeof messageObj !== "object") return;
    await this.handleInbound(messageObj as IMessageInboundPayload);
  }

  private async handleInbound(message: IMessageInboundPayload): Promise<void> {
    const decision = await resolveInboundDecision({
      config: this.config,
      message,
      pairingStore: this.pairingStore,
      storeAllowFrom: [],
    });

    if (decision.kind === "drop") return;

    if (decision.kind === "pairing") {
      this.emit("pairing", { senderId: decision.senderId, raw: message });
      if (message.sender) {
        await sendMessageIMessage({
          cliPath: this.config.cliPath,
          dbPath: this.config.dbPath,
          to: message.sender,
          text: `Pairing required. Approve this sender in your control plane. Sender: ${decision.senderId}`,
          fallbackToAppleScript: true,
        }).catch(() => undefined);
      }
      return;
    }

    this.emit("dispatch", {
      to: decision.to,
      text: decision.body,
      raw: message,
    });
  }
}
```

## 3.13 `src/distributed/mac-bridge.ts`

```ts
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { IMessageMonitor } from "../monitor.js";
import { sendMessageIMessage } from "../send.js";
import type { IMessageConfig } from "../types.js";

type BridgeMessage =
  | {
      type: "send";
      requestId: string;
      to: string;
      text: string;
      replyToId?: string;
      mediaPath?: string;
    }
  | { type: "ping"; requestId: string };

export class MacIMessageBridge {
  private clients = new Set<WebSocket>();
  private readonly monitor: IMessageMonitor;

  constructor(
    private readonly config: IMessageConfig,
    private readonly opts: { host: string; port: number; token: string }
  ) {
    this.monitor = new IMessageMonitor(config);
  }

  async start(): Promise<void> {
    const server = createServer();
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? "localhost"}`
      );
      const token = url.searchParams.get("token");
      if (token !== this.opts.token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.onClient(ws));
    });

    this.monitor.on("dispatch", ({ to, text, raw }) => {
      this.broadcast({ type: "inbound", channel: "imessage", to, text, raw });
    });
    this.monitor.on("pairing", ({ senderId, raw }) => {
      this.broadcast({ type: "pairing", channel: "imessage", senderId, raw });
    });
    this.monitor.on("error", (err) => {
      this.broadcast({
        type: "error",
        channel: "imessage",
        error: err.message,
      });
    });

    await this.monitor.start();

    await new Promise<void>((resolve) => {
      server.listen(this.opts.port, this.opts.host, () => resolve());
    });
  }

  private onClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));

    ws.on("message", (buf) => {
      void this.handleClientMessage(ws, String(buf));
    });
  }

  private async handleClientMessage(ws: WebSocket, raw: string): Promise<void> {
    let msg: BridgeMessage;
    try {
      msg = JSON.parse(raw) as BridgeMessage;
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid json" }));
      return;
    }

    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", requestId: msg.requestId }));
      return;
    }

    if (msg.type === "send") {
      try {
        const out = await sendMessageIMessage({
          cliPath: this.config.cliPath,
          dbPath: this.config.dbPath,
          to: msg.to,
          text: msg.text,
          replyToId: msg.replyToId,
          mediaPath: msg.mediaPath,
          fallbackToAppleScript: true,
        });
        ws.send(
          JSON.stringify({
            type: "send.ack",
            requestId: msg.requestId,
            messageId: out.messageId,
          })
        );
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "send.nack",
            requestId: msg.requestId,
            error: String(err),
          })
        );
      }
    }
  }

  private broadcast(payload: unknown): void {
    const json = JSON.stringify(payload);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(json);
    }
  }
}
```

## 3.14 `src/distributed/gateway-client.ts`

```ts
import WebSocket from "ws";

export class IBridgeGatewayClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retries = 0;

  constructor(
    private readonly opts: {
      bridgeUrl: string;
      token: string;
      onInbound: (payload: any) => Promise<void>;
      onPairing?: (payload: any) => Promise<void>;
      onError?: (error: string) => void;
    }
  ) {}

  connect(): void {
    const url = new URL(this.opts.bridgeUrl);
    url.searchParams.set("token", this.opts.token);

    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      this.retries = 0;
    });

    this.ws.on("message", (buf) => {
      void this.handleMessage(String(buf));
    });

    this.ws.on("close", () => this.scheduleReconnect());
    this.ws.on("error", (err) => {
      this.opts.onError?.(String(err));
      this.scheduleReconnect();
    });
  }

  async send(to: string, text: string, replyToId?: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge socket is not connected");
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.ws.send(
      JSON.stringify({ type: "send", requestId, to, text, replyToId })
    );
  }

  private async handleMessage(raw: string): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "inbound") {
      await this.opts.onInbound(msg);
      return;
    }
    if (msg.type === "pairing") {
      await this.opts.onPairing?.(msg);
      return;
    }
    if (msg.type === "error") {
      this.opts.onError?.(msg.error ?? "bridge error");
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.retries);
    this.retries += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
```

## 3.15 `src/index.ts`

```ts
import { defaultConfig } from "./config.js";
import { InMemoryPairingStore } from "./inbound-policy.js";
import { MacIMessageBridge } from "./distributed/mac-bridge.js";

async function main() {
  const config = defaultConfig();
  const pairingStore = new InMemoryPairingStore();

  const bridge = new MacIMessageBridge(config, {
    host: "127.0.0.1",
    port: 8787,
    token: process.env.IMESSAGE_BRIDGE_TOKEN ?? "change-me",
  });

  await bridge.start();
  console.log("iMessage bridge started on ws://127.0.0.1:8787");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 4) macOS and security requirements

1. Must run Messages.app with an authenticated Apple ID.
2. Grant **Full Disk Access** to the process context reading `chat.db`.
3. Grant **Automation** permission for controlling Messages via AppleScript
   (fallback path).
4. If using SSH wrapper `cliPath`, ensure key-based auth and least privilege.
5. Never allow unsafe `cliPath` values (`;`, `|`, quotes, control chars).

---

## 5) Distributed deployment pattern

## 5.1 Recommended topology

1. **Mac node** (close to Messages): runs `MacIMessageBridge` + `imsg`.
2. **Gateway/AI node** (Linux/macOS/VM): runs your model orchestration and
   connects to bridge.
3. **Secure channel**: WireGuard/Tailscale/private network + token auth +
   mTLS/reverse proxy if public.

## 5.2 Attachment handling (remote)

If inbound payload references file paths on a remote Mac:

- either transfer via SCP (as OpenClaw does with `remoteHost`),
- or make the bridge upload/stream attachment bytes directly so gateway never
  path-mounts remote files.

For production, prefer explicit binary upload/stream in bridge protocol over
shelling out to SCP from gateway.

## 5.3 Reliability checklist

1. persistent outbound queue with idempotency key
2. resend on transient RPC failures
3. heartbeat + auto reconnect for bridge websockets
4. message dedupe cache for self-echo suppression
5. structured audit log (sender, target, decision, policy reason)

---

## 6) Feature parity map

| Capability                                         | ZeroClaw        | OpenClaw                               | This TS guide          |
| -------------------------------------------------- | --------------- | -------------------------------------- | ---------------------- |
| `chat.db` polling                                  | Yes             | Optional via `imsg` internals          | Yes                    |
| `imsg rpc` JSON-RPC                                | No              | Yes                                    | Yes                    |
| AppleScript send fallback                          | Yes             | Not primary                            | Yes                    |
| DM policy + pairing                                | Basic allowlist | Full policy engine                     | Yes                    |
| Group policy + mentions                            | Minimal         | Full                                   | Yes                    |
| Remote/distributed operation                       | Not explicit    | Yes (`cliPath` wrapper + `remoteHost`) | Yes (bridge + gateway) |
| Target types (`chat_id/chat_guid/chat_identifier`) | No              | Yes                                    | Yes                    |

---

## 7) Practical replication order

1. Implement local Mac-only mode (`imsg rpc` + policy + send).
2. Add `chat.db` + AppleScript fallback path.
3. Add pairing persistence + approvals API.
4. Add distributed bridge protocol and reconnect logic.
5. Add attachment transfer hardening.
6. Add tests mirroring OpenClaw behaviors (`targets`, `send`, `gating`,
   malformed payload handling).

If you follow the file layout and code above, you’ll replicate the core iMessage
channel behavior found in both projects, with a production-ready path for
running your AI agent in distributed mode.
