export type PromptPart =
  | { type: "text"; text: string }
  | {
      type: "contact";
      email: string;
      display: string;
      contactId?: string;
    }
  | {
      type: "file";
      path: string;
      display?: string;
    };

function isHTMLElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE;
}

export function createTextFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(document.createTextNode(text));
  return fragment;
}

function getNodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0;
  }
  if (isHTMLElement(node) && node.dataset.type === "contact") {
    return node.textContent?.length ?? 0;
  }
  let total = 0;
  for (const child of node.childNodes) {
    total += getNodeLength(child);
  }
  return total;
}

function setRangeEdge(
  root: HTMLElement,
  range: Range,
  edge: "start" | "end",
  offset: number
) {
  let remaining = offset;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );
  let current: Node | null = walker.currentNode;

  while (current) {
    if (current === root) {
      current = walker.nextNode();
      continue;
    }

    const currentLength = getNodeLength(current);
    if (remaining <= currentLength) {
      if (current.nodeType === Node.TEXT_NODE) {
        if (edge === "start") {
          range.setStart(current, remaining);
        } else {
          range.setEnd(current, remaining);
        }
        return;
      }

      if (isHTMLElement(current) && current.dataset.type === "contact") {
        const parent = current.parentNode;
        if (!parent) {
          break;
        }
        const nodeIndex = Array.prototype.indexOf.call(
          parent.childNodes,
          current
        );
        if (edge === "start") {
          range.setStart(parent, nodeIndex);
        } else {
          range.setEnd(parent, nodeIndex + 1);
        }
        return;
      }
    }
    remaining -= currentLength;
    current = walker.nextNode();
  }

  if (edge === "start") {
    range.setStart(root, root.childNodes.length);
  } else {
    range.setEnd(root, root.childNodes.length);
  }
}

export function getCursorPosition(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return getNodeLength(root);
  }
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.anchorNode ?? root, selection.anchorOffset);
  return getNodeLength(range.cloneContents());
}

export function setCursorPosition(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  setRangeEdge(root, range, "start", offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function readContactPart(
  node: HTMLElement
): Extract<PromptPart, { type: "contact" }> | null {
  if (node.dataset.type !== "contact") {
    return null;
  }
  const email = node.dataset.email?.trim();
  const display =
    node.dataset.display?.trim() ?? node.textContent?.trim() ?? "";
  if (!email) {
    return null;
  }
  return {
    type: "contact",
    email,
    display,
    contactId: node.dataset.contactId,
  };
}

export function parseFromDOM(root: HTMLElement): {
  text: string;
  parts: PromptPart[];
} {
  const parts: PromptPart[] = [];
  let text = "";

  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? "";
      if (value.length > 0) {
        parts.push({ type: "text", text: value });
        text += value;
      }
      continue;
    }
    if (isHTMLElement(node)) {
      const part = readContactPart(node);
      if (part) {
        parts.push(part);
        text += `@${part.display}`;
      } else {
        const value = node.textContent ?? "";
        if (value.length > 0) {
          parts.push({ type: "text", text: value });
          text += value;
        }
      }
    }
  }

  return {
    text: text.replace(/\u00a0/g, " "),
    parts,
  };
}

export function createContactPill(input: {
  contactId: string;
  email: string;
  display: string;
}): HTMLElement {
  const span = document.createElement("span");
  span.dataset.type = "contact";
  span.dataset.contactId = input.contactId;
  span.dataset.email = input.email;
  span.dataset.display = input.display;
  span.contentEditable = "false";
  span.className =
    "mx-0.5 inline-flex items-center rounded-md bg-[var(--color-inset-bg)] px-1.5 py-0.5 text-xs";
  span.textContent = `@${input.display}`;
  return span;
}

export function replaceCurrentTokenWithNode(args: {
  root: HTMLElement;
  tokenLength: number;
  node: Node;
}): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }
  const cursor = getCursorPosition(args.root);
  const range = document.createRange();
  range.selectNodeContents(args.root);
  const start = Math.max(cursor - args.tokenLength, 0);
  setRangeEdge(args.root, range, "start", start);
  setRangeEdge(args.root, range, "end", cursor);
  range.deleteContents();
  range.insertNode(args.node);

  const spacer = createTextFragment(" ");
  range.collapse(false);
  range.insertNode(spacer);
  setCursorPosition(args.root, start + getNodeLength(args.node) + 1);
}
