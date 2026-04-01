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
  'Extraindo informações...',
  'Quase pronto...'
];

const ehMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  const [extraido, setExtraido] = useState({ cliente: false, nf: false, valor: false, vendedor: false, dt: false });
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
        cliente:  dados.cliente  || f.cliente,
        nf:       dados.nf       || f.nf,
        valor:    dados.valor    || f.valor,
        vendedor: dados.vendedor || f.vendedor,
        dt:       dados.dt       || f.dt
      }));
      setExtraido({
        cliente:  !!dados.cliente,
        nf:       !!dados.nf,
        valor:    !!dados.valor,
        vendedor: !!dados.vendedor,
        dt:       !!dados.dt
      });
    } catch (err) {
      alert('Erro ao processar documento: ' + err.message);
    } finally {
      setLendo(false);
    }
  }

  function validar() {
    const lista = [];
    if (!form.motorista.trim()) lista.push('Motorista');
    if (!form.motivo) lista.push('Motivo da Devolução');
    if (form.motivo === 'OUTROS' && !form.motivoOutros.trim()) lista.push('Descrição do motivo');
    if (!form.cliente.trim()) lista.push('Cliente');
    if (!form.nf.trim()) lista.push('NF');
    if (!form.data) lista.push('Data da Devolução');
    return lista;
  }

  async function salvar() {
    const lista = validar();
    if (lista.length > 0) {
      setErros(lista);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErros([]);
    setSalvando(true);
    try {
      const motivo = form.motivo === 'OUTROS' ? (form.motivoOutros || 'OUTROS') : form.motivo;
      const resp = await fetch(`${API}/devolucoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: form.data,
          placa: form.placa,
          dt: form.dt,
          motorista: form.motorista,
          vendedor: form.vendedor,
          cliente: form.cliente,
          nf: form.nf,
          motivo,
          valor: form.valor
        })
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
            <div className="banner-erro-titulo">Preencha os campos obrigatórios:</div>
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
                <button className="btn-upload" onClick={() => inputCameraRef.current.click()}>
                  ABRIR CÂMERA
                </button>
                <button className="btn-upload" onClick={() => inputArquivoRef.current.click()}>
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
                  <div className="upload-icone">[NF]</div>
                  <div className="upload-texto">Arraste um arquivo ou clique para selecionar</div>
                  <div className="upload-formatos">JPEG, PNG, WEBP, HEIC, PDF</div>
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
                  <div className="arquivo-preview-pdf">PDF</div>
                )}
                <div className="arquivo-info">
                  <div className="arquivo-nome">{arquivo.name}</div>
                  <div className="arquivo-tamanho">{formatarTamanho(arquivo.size)}</div>
                </div>
              </div>
            )}

            {arquivo && (
              <button className="btn-ler" onClick={lerDocumento} disabled={lendo}>
                {lendo && <div className="btn-ler-barra" />}
                {lendo ? MENSAGENS_LOADING[msgIdx] : 'LER DOCUMENTO'}
              </button>
            )}
          </div>

          {/* COLUNA DIREITA — DADOS */}
          <div>
            <div className="coluna-titulo">Dados da Entrega</div>
            <div className="form-grid">

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">MOTORISTA</label>
                <input className="form-input" type="text" value={form.motorista} onChange={e => set('motorista', e.target.value)} />
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">MOTIVO DA DEVOLUÇÃO</label>
                <select className="form-select" value={form.motivo} onChange={e => set('motivo', e.target.value)}>
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
                <input className="form-input" type="text" value={form.placa} onChange={e => set('placa', e.target.value)} />
              </div>

              <div className="form-grupo">
                <label className="form-label">DT</label>
                <input className="form-input" type="text" value={form.dt} onChange={e => set('dt', e.target.value)} />
                {extraido.dt && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label">VENDEDOR</label>
                <input className="form-input" type="text" value={form.vendedor} onChange={e => set('vendedor', e.target.value)} />
                {extraido.vendedor && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">DATA DA DEVOLUÇÃO</label>
                <input className="form-input" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">CLIENTE</label>
                <input className="form-input" type="text" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
                {extraido.cliente && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">NF</label>
                <input className="form-input" type="text" value={form.nf} onChange={e => set('nf', e.target.value)} />
                {extraido.nf && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label">VALOR</label>
                <input className="form-input" type="text" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
                {extraido.valor && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, paddingBottom: 20 }}>
          <button
            className="btn-primario"
            style={{ borderRadius: 8, height: 52 }}
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
