import { type Config } from "drizzle-kit";

import { env } from "import-alias/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  tablesFilter: ["planner1_*"],
} satisfies Config;
