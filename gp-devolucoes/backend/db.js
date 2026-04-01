require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devolucoes (
      id SERIAL PRIMARY KEY,
      data DATE NOT NULL,
      placa VARCHAR(20),
      dt VARCHAR(20),
      motorista VARCHAR(100) NOT NULL,
      vendedor VARCHAR(100),
      cliente VARCHAR(200) NOT NULL,
      nf VARCHAR(50) NOT NULL,
      motivo VARCHAR(200) NOT NULL,
      valor DECIMAL(10,2),
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Banco de dados inicializado.');
}

module.exports = { pool, initDB };
