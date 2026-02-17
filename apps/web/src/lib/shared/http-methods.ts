export const HTTP_METHODS = {
  get: "GET",
  post: "POST",
} as const;

export type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];
