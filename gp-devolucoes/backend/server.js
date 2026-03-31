require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /extrair-documento
app.post('/extrair-documento', async (req, res) => {
  try {
    const { imagem, mimeType } = req.body;
    if (!imagem || !mimeType) {
      return res.status(400).json({ erro: 'Imagem e mimeType são obrigatórios.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Você é um assistente de extração de dados de Notas Fiscais do Grupo Petrópolis. Analise a imagem desta nota fiscal e extraia exatamente os seguintes campos em JSON:
{
  "cliente": "nome do destinatário (campo DENOMINAÇÃO SOCIAL)",
  "nf": "número da nota fiscal (campo N° no cabeçalho)",
  "valor": "valor do boleto bancário (linha Total: R$, retornar apenas número no formato 000,00 sem R$ sem ponto)"
}
Se não encontrar algum campo retorne string vazia.
Retorne SOMENTE o JSON puro sem markdown sem explicações.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imagem,
          mimeType: mimeType,
        },
      },
    ]);

    const text = result.response.text().trim();
    let dados;
    try {
      dados = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        dados = JSON.parse(match[0]);
      } else {
        return res.status(422).json({ erro: 'Não foi possível extrair dados do documento.' });
      }
    }

    res.json(dados);
  } catch (err) {
    console.error('Erro ao extrair documento:', err);
    res.status(500).json({ erro: 'Erro ao processar o documento com IA.' });
  }
});

// POST /devolucoes
app.post('/devolucoes', async (req, res) => {
  try {
    const { data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor } = req.body;
    if (!data) {
      return res.status(400).json({ erro: 'Data é obrigatória.' });
    }

    const valorNum = valor ? parseFloat(String(valor).replace(',', '.')) : 0;

    const result = await pool.query(
      `INSERT INTO devolucoes (data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data, placa || '', dt || '', motorista || '', vendedor || '', cliente || '', nf || '', motivo || '', valorNum]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao salvar devolução:', err);
    res.status(500).json({ erro: 'Erro ao salvar registro.' });
  }
});

// GET /devolucoes/datas
app.get('/devolucoes/datas', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        data::text AS data,
        COUNT(*) AS quantidade,
        SUM(valor) AS total
       FROM devolucoes
       GROUP BY data
       ORDER BY data DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar datas:', err);
    res.status(500).json({ erro: 'Erro ao buscar datas.' });
  }
});

// GET /devolucoes?data=YYYY-MM-DD
app.get('/devolucoes', async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) {
      return res.status(400).json({ erro: 'Parâmetro data é obrigatório.' });
    }
    const result = await pool.query(
      `SELECT * FROM devolucoes WHERE data = $1 ORDER BY criado_em DESC`,
      [data]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar devoluções:', err);
    res.status(500).json({ erro: 'Erro ao buscar registros.' });
  }
});

// DELETE /devolucoes/:id
app.delete('/devolucoes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM devolucoes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Registro não encontrado.' });
    }
    res.json({ mensagem: 'Registro removido com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover devolução:', err);
    res.status(500).json({ erro: 'Erro ao remover registro.' });
  }
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erro ao inicializar banco:', err);
    process.exit(1);
  });
