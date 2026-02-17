import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Required for PlanetScale Postgres connections
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
