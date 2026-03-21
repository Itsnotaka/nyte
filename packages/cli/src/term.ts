import { styleText } from "node:util";

const tint = (fmt: Parameters<typeof styleText>[0], text: string) =>
  Boolean(process.stdout.isTTY) &&
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== "0" &&
  process.env.TERM !== "dumb"
    ? styleText(fmt, text, { validateStream: false })
    : text;

export const dim = (text: string) => tint("dim", text);
export const muted = (text: string) => tint(["gray", "dim"], text);
export const err = (text: string) => tint("red", text);
export const warn = (text: string) => tint("yellow", text);
export const ok = (text: string) => tint("green", text);
export const info = (text: string) => tint("cyan", text);
export const cmd = (text: string) => tint("cyan", text);
export const branch = (text: string) => tint("cyan", text);
export const current = (text: string) => tint(["cyan", "bold"], text);
export const hint = (text: string) => tint(["gray", "dim"], text);

export const say = (text: string) => {
  process.stdout.write(`${text}\n`);
};

export const note = (text: string) => {
  process.stdout.write(`${info(text)}\n`);
};

export const fail = (text: string) => {
  process.stderr.write(`${err(text)}\n`);
  process.exitCode = 1;
};
