const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devolucoes (
      id SERIAL PRIMARY KEY,
      data DATE NOT NULL,
      placa VARCHAR(20),
      dt VARCHAR(20),
      motorista VARCHAR(100),
      vendedor VARCHAR(100),
      cliente VARCHAR(200),
      nf VARCHAR(50),
      motivo VARCHAR(100),
      valor DECIMAL(10,2),
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Tabela devolucoes verificada/criada.');
}

module.exports = { pool, initDB };
