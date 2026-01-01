// scripts/check-db-state.ts
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);

async function checkDatabaseState() {
  console.log("🔍 Checking database state...\n");

  try {
    // Check what tables exist in ALL schemas
    const tables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `;

    console.log("📊 Tables in database:");
    if (tables.length === 0) {
      console.log("  (none - database is empty)");
    } else {
      tables.forEach((t) => console.log(`  - ${t.table_schema}.${t.table_name}`));
    }

    // Check if migrations tracking table exists
    const hasMigrationsTable = tables.some(
      (t) => t.table_name === "__drizzle_migrations"
    );

    if (hasMigrationsTable) {
      console.log("\n📝 Migration history (from drizzle.__drizzle_migrations table):");
      const migrations = await sql`
        SELECT id, hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at;
      `;

      if (migrations.length === 0) {
        console.log("  (no migrations recorded)");
      } else {
        migrations.forEach((m) => {
          console.log(`  - ${m.id} (${m.created_at})`);
        });
      }
    } else {
      console.log("\n⚠️  No __drizzle_migrations table found.");
      console.log("   This means you used 'db:push' instead of 'db:migrate'");
    }

    // Check record counts
    if (tables.length > 0 && tables.some(t => t.table_name === 'users')) {
      console.log("\n📈 Record counts:");
      const counts = await Promise.all([
        sql`SELECT COUNT(*) as count FROM users`.then(r => ({ table: 'users', count: r[0]?.count ?? 0 })),
        sql`SELECT COUNT(*) as count FROM projects`.then(r => ({ table: 'projects', count: r[0]?.count ?? 0 })),
        sql`SELECT COUNT(*) as count FROM tasks`.then(r => ({ table: 'tasks', count: r[0]?.count ?? 0 })),
      ]);
      counts.forEach(({ table, count }) => {
        console.log(`  ${table}: ${count} records`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await sql.end();
  }
}

checkDatabaseState();
