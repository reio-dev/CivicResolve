/**
 * Database Reset Script
 * Drops all tables and recreates them using Drizzle
 */

const { Pool } = require("pg");
require("dotenv").config();

const tables = [
    "user_badges",
    "badges",
    "status_updates",
    "comments",
    "validations",
    "issue_assignments",
    "issues",
    "resolvers",
    "admin_users",
    "departments",
    "redemptions",
    "credit_allocations",
    "notifications",
    "users",
];

async function resetDatabase() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error("ERROR: DATABASE_URL environment variable is not set");
        console.log("Create a .env file with DATABASE_URL=postgresql://...");
        process.exit(1);
    }

    const pool = new Pool({ connectionString: databaseUrl });

    try {
        console.log("Connecting to database...");
        const client = await pool.connect();

        console.log("Dropping all tables...");
        for (const table of tables) {
            try {
                await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
                console.log(`  Dropped: ${table}`);
            } catch (err) {
                console.log(`  Skipped: ${table} (${err.message})`);
            }
        }

        client.release();
        await pool.end();

        console.log("\nAll tables dropped successfully!");
        console.log('\nRun "npm run db:push" to recreate the schema.');
    } catch (error) {
        console.error("Database reset failed:", error.message);
        await pool.end();
        process.exit(1);
    }
}

resetDatabase();
