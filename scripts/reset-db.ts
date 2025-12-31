// scripts/reset-db.ts
/**
 * DANGER: This script drops ALL tables in your database
 * Use this to reset your database to a clean state before running migrations
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);

async function resetDatabase() {
  console.log("⚠️  WARNING: This will DROP ALL TABLES in your database!");
  console.log("Database:", DATABASE_URL.split("@")[1]?.split("/")[0], "\n");

  try {
    // First, drop the drizzle schema completely to reset migration tracking
    console.log("🗑️  Dropping drizzle schema...");
    await sql.unsafe(`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    console.log("   Dropped: drizzle schema\n");

    // Get all tables in public schema
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    `;

    if (tables.length === 0) {
      console.log("✅ Database is already empty - nothing to drop");
      return;
    }

    console.log("📋 Tables to be dropped:");
    tables.forEach((t) => console.log(`  - ${t.table_name}`));
    console.log("");

    // Drop all tables with CASCADE
    console.log("🗑️  Dropping all tables...");
    for (const { table_name } of tables) {
      await sql.unsafe(`DROP TABLE IF EXISTS "${table_name}" CASCADE`);
      console.log(`   Dropped: ${table_name}`);
    }

    console.log("\n✅ Database reset complete!");
    console.log("\nNext steps:");
    console.log("  1. Run: pnpm db:migrate");
    console.log("  2. Run: pnpm db:seed");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

resetDatabase();
