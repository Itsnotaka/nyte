type Pull = {
  owner: string;
  repo: string;
  pullNumber: number;
};

type Ref = {
  owner: string;
  repo: string;
  ref: string;
};

type Cfg = {
  staleTime: number;
};

type Opt = {
  staleTime: number;
  trpc: {
    context: {
      skipBatch: true;
    };
  };
};

type Query<T> = {
  input: T;
  opts: Opt;
};

const ctx = {
  context: {
    skipBatch: true,
  },
} as const;

function wrap<T>(input: T, cfg: Cfg): Query<T> {
  return {
    input,
    opts: {
      staleTime: cfg.staleTime,
      trpc: ctx,
    },
  };
}

export const page = wrap<Pull>;
export const stack = wrap<Pull>;
export const discussion = wrap<Pull>;
export const review = wrap<Pull>;
export const check = wrap<Ref>;
