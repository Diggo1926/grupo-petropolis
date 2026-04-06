import os
import re
import json
import tempfile
import psycopg2
import psycopg2.extras
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

DATABASE_URL = os.environ.get('DATABASE_URL', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

EXTENSOES_GEMINI = {'.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic'}

MIME_MAP = {
    '.pdf':  'application/pdf',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
}

# ─── Banco ───────────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DATABASE_URL, sslmode='require')


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS devolucoes (
                    id         SERIAL PRIMARY KEY,
                    data       DATE          NOT NULL,
                    placa      VARCHAR(20),
                    dt         VARCHAR(20),
                    motorista  VARCHAR(100)  NOT NULL,
                    vendedor   VARCHAR(100),
                    cliente    VARCHAR(200)  NOT NULL,
                    nf         VARCHAR(50)   NOT NULL,
                    motivo     VARCHAR(200)  NOT NULL,
                    valor      DECIMAL(10,2),
                    criado_em  TIMESTAMP     DEFAULT NOW()
                )
            """)
            cur.execute(
                "ALTER TABLE devolucoes ADD COLUMN IF NOT EXISTS observacao TEXT DEFAULT ''"
            )
        conn.commit()
    print('Banco inicializado.')


def row_to_dict(row, cursor):
    cols = [desc[0] for desc in cursor.description]
    d = dict(zip(cols, row))
    for k, v in d.items():
        if hasattr(v, 'isoformat'):
            d[k] = v.isoformat()
    return d

# ─── OCR fallback ────────────────────────────────────────────────────────────

def extrair_com_ocr(caminho, ext):
    texto = ''
    try:
        if ext == '.pdf':
            import pdfplumber
            with pdfplumber.open(caminho) as pdf:
                for pg in pdf.pages:
                    t = pg.extract_text()
                    if t:
                        texto += t + '\n'
            if not texto.strip():
                from pdf2image import convert_from_path
                import pytesseract
                imgs = convert_from_path(caminho, dpi=200)
                for img in imgs:
                    texto += pytesseract.image_to_string(img, lang='por') + '\n'
        else:
            from PIL import Image
            import pytesseract
            img = Image.open(caminho)
            texto = pytesseract.image_to_string(img, lang='por')
    except Exception as e:
        print(f'OCR falhou: {e}')
        return {'cliente': '', 'nf': '', 'valor': '', 'vendedor': '', 'dt': '', '_metodo': 'erro_ocr'}

    nf = ''
    m = re.search(r'N[o0]\s*[:.]?\s*(\d{6,12})', texto)
    if m:
        nf = m.group(1)

    valor = ''
    m = re.search(r'Total[:\s]+R\$\s*([\d.,]+)', texto, re.IGNORECASE)
    if m:
        valor = m.group(1)

    cliente = ''
    linhas = texto.splitlines()
    capturar = False
    for linha in linhas:
        if re.search(r'DENOMINACAO SOCIAL|DESTINATARIO', linha, re.IGNORECASE):
            capturar = True
            continue
        if capturar and linha.strip():
            palavras = linha.strip().split()
            if len(palavras) >= 2 and linha.strip().isupper():
                cliente = linha.strip()
                break
            capturar = False

    dt = ''
    m = re.search(r'Doc\.?Transporte[:\s]+(\d{7,12})', texto, re.IGNORECASE)
    if not m:
        m = re.search(r'\b(600\d{7,9})\b', texto)
    if m:
        dt = m.group(1).strip()

    vendedor = ''
    m = re.search(
        r'Vendedor[:\s]+\d+\s*-\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{2,50}?)(?:\n|Nosso|Pedido|$)',
        texto, re.IGNORECASE
    )
    if m:
        vendedor = m.group(1).strip()

    return {'cliente': cliente, 'nf': nf, 'valor': valor, 'vendedor': vendedor, 'dt': dt, '_metodo': 'ocr'}

# ─── Rotas ───────────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    banco = False
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
        banco = True
    except Exception:
        pass
    return jsonify({'status': 'ok', 'gemini': bool(GEMINI_API_KEY), 'banco': banco, 'versao': '2.0'})


@app.route('/extrair-documento', methods=['POST'])
def extrair_documento():
    if 'arquivo' not in request.files:
        return jsonify({'erro': 'Campo "arquivo" nao encontrado.'}), 400

    arquivo = request.files['arquivo']
    nome = arquivo.filename or 'arquivo'
    ext = os.path.splitext(nome)[1].lower()

    fd, caminho = tempfile.mkstemp(suffix=ext, dir=UPLOAD_DIR)
    os.close(fd)

    try:
        arquivo.save(caminho)

        if GEMINI_API_KEY and ext in EXTENSOES_GEMINI:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel('gemini-1.5-flash')

                mime = MIME_MAP.get(ext, 'application/octet-stream')
                with open(caminho, 'rb') as f:
                    dados_bin = f.read()

                prompt = """Você é um assistente de extração de dados de Notas Fiscais do Grupo Petrópolis. Analise este documento com atenção especial à seção DADOS ADICIONAIS no rodapé e extraia os seguintes campos em JSON:

{
  "cliente": "nome completo no campo NOME/RAZÃO SOCIAL da seção DESTINATÁRIO/REMETENTE",
  "nf": "número da nota fiscal no campo Nº do cabeçalho, apenas os dígitos ex: 000388011",
  "valor": "valor total da nota fiscal, campo V.TOTAL NOTA ou VALOR TOTAL, apenas números no formato 000.00 sem R$ sem ponto de milhar",
  "dt": "número do Doc.Transporte que aparece nos DADOS ADICIONAIS ou INFORMAÇÕES COMPLEMENTARES após o texto Doc.Transporte: exemplo: Doc.Transporte: 6000876356",
  "vendedor": "nome do vendedor que aparece nos DADOS ADICIONAIS ou INFORMAÇÕES COMPLEMENTARES após Vendedor:, exemplo: Vendedor: 00246840 - RONALDO SANTOS, extrair apenas RONALDO SANTOS sem o código numérico"
}

Exemplos reais de como esses campos aparecem no documento:
  Remessa: 8202847009 Doc.Transporte: 6000876356
  Cliente: 0210491177 / Vendedor: 00246840 - RONALDO SANTOS

INSTRUÇÕES IMPORTANTES:
- O campo vendedor quase sempre está nas INFORMAÇÕES COMPLEMENTARES ou DADOS ADICIONAIS no rodapé da nota, não no cabeçalho. Leia o rodapé com atenção.
- O campo valor corresponde ao V.TOTAL NOTA que aparece no canto direito da seção de cálculo de impostos.
- O campo dt é o número após Doc.Transporte: nos dados adicionais, nunca o número da NF.
- A imagem pode estar levemente inclinada ou com baixa qualidade. Faça o melhor esforço para ler todos os campos.
- Se não encontrar algum campo retorne string vazia.
- Retorne SOMENTE o JSON puro sem markdown sem texto adicional.
"""
                texto = resposta.text.strip()

                texto = re.sub(r'^```[a-z]*\n?', '', texto)
                texto = re.sub(r'\n?```$', '', texto)

                dados = json.loads(texto)
                return jsonify({
                    'cliente':  dados.get('cliente', ''),
                    'nf':       dados.get('nf', ''),
                    'valor':    dados.get('valor', ''),
                    'vendedor': dados.get('vendedor', ''),
                    'dt':       dados.get('dt', ''),
                    '_metodo':  'gemini'
                })
            except Exception as e:
                print(f'Gemini falhou, usando fallback OCR: {e}')

        resultado = extrair_com_ocr(caminho, ext)
        return jsonify(resultado)

    except Exception as e:
        return jsonify({'erro': str(e)}), 500
    finally:
        try:
            os.remove(caminho)
        except Exception:
            pass


@app.route('/devolucoes/datas')
def listar_datas():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT data, COUNT(*) AS quantidade, SUM(valor) AS total
                       FROM devolucoes
                       GROUP BY data
                       ORDER BY data DESC"""
                )
                rows = cur.fetchall()
                resultado = []
                for row in rows:
                    resultado.append({
                        'data':       row[0].isoformat() if row[0] else None,
                        'quantidade': row[1],
                        'total':      float(row[2]) if row[2] is not None else 0.0
                    })
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/meses')
def listar_meses():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT TO_CHAR(data, 'YYYY-MM') AS mes,
                              COUNT(*) AS quantidade,
                              SUM(valor) AS total
                       FROM devolucoes
                       GROUP BY mes
                       ORDER BY mes DESC"""
                )
                rows = cur.fetchall()
                resultado = [
                    {'mes': row[0], 'quantidade': row[1], 'total': float(row[2]) if row[2] is not None else 0.0}
                    for row in rows
                ]

        from datetime import date
        mes_atual = date.today().strftime('%Y-%m')
        if not any(r['mes'] == mes_atual for r in resultado):
            resultado.insert(0, {'mes': mes_atual, 'quantidade': 0, 'total': 0.0})

        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/dias')
def listar_dias():
    mes = request.args.get('mes', '')
    if not mes:
        return jsonify({'erro': 'Parâmetro mes obrigatório.'}), 400
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT data::text AS data,
                              COUNT(*) AS quantidade,
                              SUM(valor) AS total
                       FROM devolucoes
                       WHERE TO_CHAR(data, 'YYYY-MM') = %s
                       GROUP BY data
                       ORDER BY data DESC""",
                    (mes,)
                )
                rows = cur.fetchall()
                resultado = [
                    {'data': row[0], 'quantidade': row[1], 'total': float(row[2]) if row[2] is not None else 0.0}
                    for row in rows
                ]

        from datetime import date
        hoje = date.today().isoformat()
        if hoje.startswith(mes) and not any(r['data'] == hoje for r in resultado):
            resultado.insert(0, {'data': hoje, 'quantidade': 0, 'total': 0.0})

        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/busca')
def buscar_devolucoes():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, data, cliente, nf, valor, motivo
                       FROM devolucoes
                       WHERE cliente ILIKE %s OR nf ILIKE %s
                       ORDER BY criado_em DESC
                       LIMIT 10""",
                    (f'%{q}%', f'%{q}%')
                )
                rows = cur.fetchall()
                resultado = []
                for row in rows:
                    resultado.append({
                        'id':      row[0],
                        'data':    row[1].isoformat() if row[1] else None,
                        'cliente': row[2],
                        'nf':      row[3],
                        'valor':   float(row[4]) if row[4] is not None else 0.0,
                        'motivo':  row[5]
                    })
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/recentes')
def listar_recentes():
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT placa, motorista FROM devolucoes
                       ORDER BY criado_em DESC LIMIT 30"""
                )
                rows = cur.fetchall()
                placas = []
                motoristas = []
                seen_p = set()
                seen_m = set()
                for row in rows:
                    p, m = row[0], row[1]
                    if p and p not in seen_p and len(placas) < 5:
                        placas.append(p)
                        seen_p.add(p)
                    if m and m not in seen_m and len(motoristas) < 5:
                        motoristas.append(m)
                        seen_m.add(m)
        return jsonify({'placas': placas, 'motoristas': motoristas})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes', methods=['GET'])
def listar_devolucoes():
    data = request.args.get('data')
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'SELECT * FROM devolucoes WHERE data = %s ORDER BY criado_em DESC',
                    (data,)
                )
                rows = cur.fetchall()
                resultado = [row_to_dict(r, cur) for r in rows]
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes', methods=['POST'])
def criar_devolucao():
    body = request.get_json() or {}
    motorista = body.get('motorista', '').strip()
    cliente   = body.get('cliente', '').strip()
    nf        = body.get('nf', '').strip()
    motivo    = body.get('motivo', '').strip()

    if not motorista or not cliente or not nf or not motivo:
        return jsonify({'erro': 'Campos obrigatórios: motorista, cliente, nf, motivo.'}), 400

    valor_str = str(body.get('valor') or '0').replace(',', '.')
    try:
        valor = float(valor_str)
    except ValueError:
        valor = 0.0

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Verificar NF duplicada
                cur.execute(
                    'SELECT id, cliente, data FROM devolucoes WHERE nf = %s',
                    (nf,)
                )
                existente = cur.fetchone()
                if existente:
                    data_fmt = existente[2].strftime('%d/%m/%Y') if existente[2] else ''
                    return jsonify({
                        'erro':      'NF duplicada',
                        'duplicado': True,
                        'mensagem':  f'A NF {nf} já foi registrada para o cliente {existente[1]} em {data_fmt}'
                    }), 409

                cur.execute(
                    """INSERT INTO devolucoes
                       (data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor, observacao)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING *""",
                    (
                        body.get('data'),
                        body.get('placa') or None,
                        body.get('dt') or None,
                        motorista,
                        body.get('vendedor') or None,
                        cliente,
                        nf,
                        motivo,
                        valor,
                        body.get('observacao') or ''
                    )
                )
                row = cur.fetchone()
                registro = row_to_dict(row, cur)
            conn.commit()
        return jsonify(registro), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/<int:id>', methods=['PUT'])
def atualizar_devolucao(id):
    body = request.get_json() or {}

    valor_str = str(body.get('valor') or '0').replace(',', '.')
    try:
        valor = float(valor_str)
    except ValueError:
        valor = 0.0

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """UPDATE devolucoes
                       SET data=%s, placa=%s, dt=%s, motorista=%s, vendedor=%s,
                           cliente=%s, nf=%s, motivo=%s, valor=%s, observacao=%s
                       WHERE id=%s
                       RETURNING *""",
                    (
                        body.get('data'),
                        body.get('placa') or None,
                        body.get('dt') or None,
                        body.get('motorista'),
                        body.get('vendedor') or None,
                        body.get('cliente'),
                        body.get('nf'),
                        body.get('motivo'),
                        valor,
                        body.get('observacao') or '',
                        id
                    )
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({'erro': 'Registro não encontrado.'}), 404
                registro = row_to_dict(row, cur)
            conn.commit()
        return jsonify(registro)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes/<int:id>', methods=['DELETE'])
def deletar_devolucao(id):
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    'DELETE FROM devolucoes WHERE id=%s RETURNING id',
                    (id,)
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({'erro': 'Registro não encontrado.'}), 404
            conn.commit()
        return jsonify({'mensagem': 'Removido com sucesso.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)
