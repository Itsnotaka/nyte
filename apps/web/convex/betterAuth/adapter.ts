import { createApi } from "@convex-dev/better-auth";

import { createAuthOptions } from "./auth";
import schema from "./schema";

const adapterApi = createApi(schema, createAuthOptions);

export const create: any = adapterApi.create;
export const findOne: any = adapterApi.findOne;
export const findMany: any = adapterApi.findMany;
export const updateOne: any = adapterApi.updateOne;
export const updateMany: any = adapterApi.updateMany;
export const deleteOne: any = adapterApi.deleteOne;
export const deleteMany: any = adapterApi.deleteMany;
