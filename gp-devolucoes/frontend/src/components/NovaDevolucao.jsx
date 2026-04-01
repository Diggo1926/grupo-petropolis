import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const MOTIVOS = [
  'ENDERECO ERRADO',
  'PDV FECHADO',
  'FALTA DE PAGAMENTO',
  'DUPLICIDADE',
  'RECUSA',
  'OUTROS'
];

const MENSAGENS_LOADING = [
  'Enviando documento...',
  'Analisando com IA...',
  'Extraindo informacoes...',
  'Quase pronto...'
];

const ehMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function hojeISO() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}


export default function NovaDevolucao() {
  const navigate = useNavigate();

  const [arquivo, setArquivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [lendo, setLendo] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [extraido, setExtraido] = useState({ cliente: false, nf: false, valor: false });
  const [dragover, setDragover] = useState(false);

  const [form, setForm] = useState({
    motorista: '',
    motivo: '',
    motivoOutros: '',
    placa: '',
    dt: '',
    vendedor: '',
    data: hojeISO(),
    cliente: '',
    nf: '',
    valor: ''
  });

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);

  const inputCameraRef = useRef();
  const inputArquivoRef = useRef();
  const inputDesktopRef = useRef();

  // Mensagens rotativas durante leitura
  useEffect(() => {
    if (!lendo) return;
    setMsgIdx(0);
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % MENSAGENS_LOADING.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [lendo]);

  function set(campo, val) {
    setForm(f => ({ ...f, [campo]: val }));
  }

  function handleArquivo(file) {
    if (!file) return;
    setArquivo(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl('');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleArquivo(file);
  }

  async function lerDocumento() {
    if (!arquivo) return;
    setLendo(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const resp = await fetch(`${API}/extrair-documento`, {
        method: 'POST',
        body: formData
      });
      const dados = await resp.json();

      if (dados.erro) {
        alert('Erro ao ler documento: ' + dados.erro);
        return;
      }

      setForm(f => ({
        ...f,
        cliente: dados.cliente || f.cliente,
        nf: dados.nf || f.nf,
        valor: dados.valor || f.valor
      }));
      setExtraido({
        cliente: !!dados.cliente,
        nf: !!dados.nf,
        valor: !!dados.valor
      });
    } catch (err) {
      alert('Erro ao processar documento: ' + err.message);
    } finally {
      setLendo(false);
    }
  }

  function validar() {
    const errosEncontrados = [];
    if (!form.motorista.trim()) errosEncontrados.push('Motorista');
    if (!form.motivo) errosEncontrados.push('Motivo da Devolucao');
    if (form.motivo === 'OUTROS' && !form.motivoOutros.trim()) errosEncontrados.push('Descricao do motivo');
    if (!form.cliente.trim()) errosEncontrados.push('Cliente');
    if (!form.nf.trim()) errosEncontrados.push('NF');
    if (!form.data) errosEncontrados.push('Data da Devolucao');
    return errosEncontrados;
  }

  async function salvar() {
    const errosEncontrados = validar();
    if (errosEncontrados.length > 0) {
      setErros(errosEncontrados);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErros([]);
    setSalvando(true);
    try {
      const motivo = form.motivo === 'OUTROS' ? (form.motivoOutros || 'OUTROS') : form.motivo;
      const body = {
        data: form.data,
        placa: form.placa,
        dt: form.dt,
        motorista: form.motorista,
        vendedor: form.vendedor,
        cliente: form.cliente,
        nf: form.nf,
        motivo,
        valor: form.valor
      };
      const resp = await fetch(`${API}/devolucoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const salvo = await resp.json();
      if (salvo.erro) {
        alert('Erro ao salvar: ' + salvo.erro);
        return;
      }
      navigate(`/dia/${form.data}`);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  const motivoEOutros = form.motivo === 'OUTROS';

  return (
    <div className="page">
      <div className="container">
        <div className="tela-header">
          <button className="btn-voltar" onClick={() => navigate('/')}>
            &#8592; Voltar
          </button>
          <span className="tela-header-titulo">Novo Registro</span>
        </div>

        {erros.length > 0 && (
          <div className="banner-erro">
            <div className="banner-erro-titulo">Preencha os campos obrigatorios:</div>
            <ul>
              {erros.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="nova-layout">
          {/* COLUNA ESQUERDA — DOCUMENTO */}
          <div>
            <div className="coluna-titulo">Documento (opcional)</div>

            {ehMobile ? (
              <div className="upload-botoes-mobile">
                <button
                  className="btn-upload"
                  onClick={() => inputCameraRef.current.click()}
                >
                  ABRIR CAMERA
                </button>
                <button
                  className="btn-upload"
                  onClick={() => inputArquivoRef.current.click()}
                >
                  ESCOLHER ARQUIVO
                </button>
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => handleArquivo(e.target.files[0])}
                />
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleArquivo(e.target.files[0])}
                />
              </div>
            ) : (
              <>
                <div
                  className={`upload-area${dragover ? ' dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={handleDrop}
                  onClick={() => inputDesktopRef.current.click()}
                >
                  <div style={{ fontSize: 32, color: 'var(--cor-borda)' }}>&#128196;</div>
                  <div className="upload-texto">
                    Arraste um arquivo ou clique para selecionar
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cor-texto-suave)', marginTop: 4 }}>
                    JPEG, PNG, WEBP, HEIC, PDF
                  </div>
                </div>
                <input
                  ref={inputDesktopRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleArquivo(e.target.files[0])}
                />
              </>
            )}

            {arquivo && (
              <div className="arquivo-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" />
                ) : (
                  <div style={{
                    width: 48, height: 48, background: '#F3F4F6', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20
                  }}>
                    &#128196;
                  </div>
                )}
                <div className="arquivo-info">
                  <div className="arquivo-nome">{arquivo.name}</div>
                  <div className="arquivo-tamanho">{formatarTamanho(arquivo.size)}</div>
                </div>
              </div>
            )}

            {arquivo && (
              <button
                className="btn-ler"
                onClick={lerDocumento}
                disabled={lendo}
              >
                {lendo && <div className="btn-ler-barra" />}
                {lendo ? MENSAGENS_LOADING[msgIdx] : 'LER DOCUMENTO'}
              </button>
            )}
          </div>

          {/* COLUNA DIREITA — DADOS DA ENTREGA */}
          <div>
            <div className="coluna-titulo">Dados da Entrega</div>
            <div className="form-grid">

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">MOTORISTA</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.motorista}
                  onChange={e => set('motorista', e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">MOTIVO DA DEVOLUCAO</label>
                <select
                  className="form-select"
                  value={form.motivo}
                  onChange={e => set('motivo', e.target.value)}
                >
                  <option value="">Selecione o motivo...</option>
                  {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {motivoEOutros && (
                  <textarea
                    className="form-textarea"
                    style={{ marginTop: 8 }}
                    placeholder="Descreva o motivo"
                    value={form.motivoOutros}
                    onChange={e => set('motivoOutros', e.target.value)}
                  />
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label">PLACA</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.placa}
                  onChange={e => set('placa', e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label">DT</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.dt}
                  onChange={e => set('dt', e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label">VENDEDOR</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.vendedor}
                  onChange={e => set('vendedor', e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">DATA DA DEVOLUCAO</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.data}
                  onChange={e => set('data', e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">CLIENTE</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.cliente}
                  onChange={e => set('cliente', e.target.value)}
                />
                {extraido.cliente && (
                  <span className="badge-extraido">Extraido automaticamente</span>
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">NF</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.nf}
                  onChange={e => set('nf', e.target.value)}
                />
                {extraido.nf && (
                  <span className="badge-extraido">Extraido automaticamente</span>
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label">VALOR</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => set('valor', e.target.value)}
                />
                {extraido.valor && (
                  <span className="badge-extraido">Extraido automaticamente</span>
                )}
              </div>

            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <button
            className="btn-primario"
            style={{ maxWidth: '100%' }}
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : 'SALVAR REGISTRO'}
          </button>
        </div>
      </div>
    </div>
  );
}
