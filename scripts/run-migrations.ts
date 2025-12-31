// scripts/run-migrations.ts
/**
 * Run database migrations
 * This actually executes the SQL migration files
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;

async function runMigrations() {
  console.log("🚀 Running database migrations...\n");

  // Create connection for migrations
  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully!\n");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

runMigrations()
  .then(() => {
    console.log("👋 Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to run migrations:", error);
    process.exit(1);
  });
