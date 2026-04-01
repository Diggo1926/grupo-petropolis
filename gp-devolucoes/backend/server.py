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
        return {'cliente': '', 'nf': '', 'valor': '', '_metodo': 'erro_ocr'}

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

    return {'cliente': cliente, 'nf': nf, 'valor': valor, '_metodo': 'ocr'}

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

        # Tenta Gemini primeiro
        if GEMINI_API_KEY and ext in EXTENSOES_GEMINI:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel('gemini-1.5-flash')

                mime = MIME_MAP.get(ext, 'application/octet-stream')
                with open(caminho, 'rb') as f:
                    dados_bin = f.read()

                prompt = (
                    "Voce e um assistente de extracao de dados de Notas Fiscais do "
                    "Grupo Petropolis. Analise este documento e extraia em JSON:\n"
                    "{\n"
                    "  cliente: nome do destinatario (campo DENOMINACAO SOCIAL),\n"
                    "  nf: numero da nota fiscal (campo No no cabecalho, ex: 000191237),\n"
                    "  valor: valor do boleto (linha Total: R$, retornar apenas numeros "
                    "no formato 000,00 sem R$ sem ponto de milhar)\n"
                    "}\n"
                    "Se nao encontrar retorne string vazia.\n"
                    "Retorne SOMENTE o JSON puro sem markdown sem explicacoes."
                )

                resposta = model.generate_content([
                    {'mime_type': mime, 'data': dados_bin},
                    prompt
                ])
                texto = resposta.text.strip()

                # Remove markdown se presente
                texto = re.sub(r'^```[a-z]*\n?', '', texto)
                texto = re.sub(r'\n?```$', '', texto)

                dados = json.loads(texto)
                return jsonify({
                    'cliente': dados.get('cliente', ''),
                    'nf':      dados.get('nf', ''),
                    'valor':   dados.get('valor', ''),
                    '_metodo': 'gemini'
                })
            except Exception as e:
                print(f'Gemini falhou, usando fallback OCR: {e}')

        # Fallback OCR
        resultado = extrair_com_ocr(caminho, ext)
        return jsonify(resultado)

    except Exception as e:
        return jsonify({'erro': str(e)}), 500
    finally:
        try:
            os.remove(caminho)
        except Exception:
            pass


@app.route('/devolucoes', methods=['POST'])
def criar_devolucao():
    body = request.get_json() or {}
    motorista = body.get('motorista', '').strip()
    cliente   = body.get('cliente', '').strip()
    nf        = body.get('nf', '').strip()
    motivo    = body.get('motivo', '').strip()

    if not motorista or not cliente or not nf or not motivo:
        return jsonify({'erro': 'Campos obrigatorios: motorista, cliente, nf, motivo.'}), 400

    valor_str = str(body.get('valor') or '0').replace(',', '.')
    try:
        valor = float(valor_str)
    except ValueError:
        valor = 0.0

    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO devolucoes
                       (data, placa, dt, motorista, vendedor, cliente, nf, motivo, valor)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                        valor
                    )
                )
                row = cur.fetchone()
                registro = row_to_dict(row, cur)
            conn.commit()
        return jsonify(registro), 201
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


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
                    d = {
                        'data':       row[0].isoformat() if row[0] else None,
                        'quantidade': row[1],
                        'total':      float(row[2]) if row[2] is not None else 0.0
                    }
                    resultado.append(d)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/devolucoes')
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
                           cliente=%s, nf=%s, motivo=%s, valor=%s
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
                        id
                    )
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({'erro': 'Registro nao encontrado.'}), 404
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
                    return jsonify({'erro': 'Registro nao encontrado.'}), 404
            conn.commit()
        return jsonify({'mensagem': 'Removido com sucesso.'})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=False)
