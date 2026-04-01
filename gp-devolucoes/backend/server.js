require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MIME_TYPES_ACEITOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf'
];

// GET /health
app.get('/health', async (req, res) => {
  let banco = false;
  try {
    await pool.query('SELECT 1');
    banco = true;
  } catch (_) {}
  res.json({ status: 'ok', gemini: !!process.env.GEMINI_API_KEY, banco });
});

// POST /extrair-documento
app.post('/extrair-documento', async (req, res) => {
  try {
    const { imagem, mimeType } = req.body;

    if (!MIME_TYPES_ACEITOS.includes(mimeType)) {
      return res.status(400).json({
        erro: `Tipo de arquivo nao suportado: ${mimeType}. Use JPEG, PNG, WEBP, HEIC ou PDF.`
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Voce e um assistente de extracao de dados de Notas Fiscais do Grupo Petropolis. Analise esta nota fiscal e extraia em JSON:
{
  cliente: nome do destinatario (campo DENOMINACAO SOCIAL),
  nf: numero da nota fiscal (campo No no cabecalho),
  valor: valor do boleto (linha Total: R$, apenas numeros no formato 000,00 sem R$ sem ponto de milhar)
}
Se nao encontrar retorne string vazia.
Retorne SOMENTE o JSON puro sem markdown.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imagem,
          mimeType: mimeType
        }
      }
    ]);

    const texto = result.response.text();

    let dados;
    try {
      dados = JSON.parse(texto);
    } catch (_) {
      const match = texto.match(/\{[\s\S]*\}/);
      if (match) {
        dados = JSON.parse(match[0]);
      } else {
        dados = { cliente: '', nf: '', valor: '' };
      }
    }

    res.json({
      cliente: dados.cliente || '',
      nf: dados.nf || '',
      valor: dados.valor || ''
    });
  } catch (err) {
    console.error('Erro ao extrair documento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// POST /devolucoes
app.post('/devolucoes', async (req, res) => {
  try {
    const { data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor } = req.body;

    if (!motorista || !cliente || !nf || !motivo) {
      return res.status(400).json({ erro: 'Campos obrigatorios: motorista, cliente, nf, motivo.' });
    }

    const valorNumerico = parseFloat(String(valor || '0').replace(',', '.')) || 0;

    const result = await pool.query(
      `INSERT INTO devolucoes (data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data, placa || null, dt || null, motorista, vendedor || null, cliente, nf, motivo, valorNumerico]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar devolucao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /devolucoes/datas
app.get('/devolucoes/datas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT data, COUNT(*) AS quantidade, SUM(valor) AS total
       FROM devolucoes
       GROUP BY data
       ORDER BY data DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar datas:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// GET /devolucoes?data=YYYY-MM-DD
app.get('/devolucoes', async (req, res) => {
  try {
    const { data } = req.query;
    const result = await pool.query(
      `SELECT * FROM devolucoes WHERE data = $1 ORDER BY criado_em DESC`,
      [data]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar devolucoes:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// PUT /devolucoes/:id
app.put('/devolucoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor } = req.body;

    const valorNumerico = parseFloat(String(valor || '0').replace(',', '.')) || 0;

    const result = await pool.query(
      `UPDATE devolucoes
       SET data=$1, placa=$2, dt=$3, motorista=$4, vendedor=$5,
           cliente=$6, nf=$7, motivo=$8, valor=$9
       WHERE id=$10
       RETURNING *`,
      [data, placa || null, dt || null, motorista, vendedor || null, cliente, nf, motivo, valorNumerico, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Registro nao encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar devolucao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// DELETE /devolucoes/:id
app.delete('/devolucoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM devolucoes WHERE id=$1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Registro nao encontrado.' });
    }

    res.json({ mensagem: 'Removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover devolucao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log('Backend rodando na porta ' + PORT);
  });
}).catch(err => {
  console.error('Erro ao inicializar banco:', err.message);
  process.exit(1);
});
