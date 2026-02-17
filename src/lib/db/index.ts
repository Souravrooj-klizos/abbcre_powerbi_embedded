/**
 * PostgreSQL connection pool and DB helpers.
 * Use a single pool; do not create new connections per request.
 *
 * Example (after installing pg):
 *   import { Pool } from "pg";
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   export { pool };
 */

// Placeholder until pg is added and DATABASE_URL is configured
export const getDbConfig = () => ({
  connectionString: process.env.DATABASE_URL,
});
