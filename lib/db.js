import { neon } from '@neondatabase/serverless';

// Conexión a la base de datos.
// En Vercel se usa Neon (la variable DATABASE_URL la crea Vercel al conectar Neon).
// Para pruebas locales con un Postgres normal: DB_DRIVER=pg.

let runner;

async function getRunner() {
  if (runner) return runner;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'Falta la variable DATABASE_URL. En Vercel: Storage → Neon → Connect al proyecto.'
    );
  }
  if (process.env.DB_DRIVER === 'pg') {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url });
    runner = async (text, params = []) => (await pool.query(text, params)).rows;
  } else {
    const sql = neon(url);
    runner = (text, params = []) => sql.query(text, params);
  }
  return runner;
}

export async function q(text, params = []) {
  const run = await getRunner();
  return run(text, params);
}

export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] ?? null;
}
