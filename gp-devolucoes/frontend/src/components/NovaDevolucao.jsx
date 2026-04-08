import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const MOTIVOS = ['Ausente', 'Desistência', 'Outros'];

const MENSAGENS_LOADING = [
  'Enviando documento...',
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

function Toast({ toast }) {
  if (!toast.visivel) return null;
  return (
    <div className="toast" style={{ background: toast.cor || '#16a34a' }}>
      <div className="toast-check">&#10003;</div>
      {toast.mensagem}
    </div>
  );
}

export default function NovaDevolucao() {
  const navigate = useNavigate();
  const location = useLocation();

  const estadoInicial = {
    motorista: '',
    motivo: '',
    placa: '',
    dt: '',
    vendedor: '',
    data: hojeISO(),
    cliente: '',
    nf: '',
    valor: '',
    observacao: ''
  };

  const [form, setForm] = useState(estadoInicial);
  const [motivoSelect, setMotivoSelect] = useState('');

  const [arquivo, setArquivo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [lendo, setLendo] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [extraido, setExtraido] = useState({ cliente: false, nf: false, valor: false, vendedor: false, dt: false });
  const [dragover, setDragover] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState([]);
  const [erroDuplicada, setErroDuplicada] = useState('');
  const [limpo, setLimpo] = useState(false);
  const [toast, setToast] = useState({ visivel: false, mensagem: '', cor: '' });

  const [progresso, setProgresso] = useState(0);
  const [progressoVisivel, setProgressoVisivel] = useState(false);

  const [recentes, setRecentes] = useState({ placas: [], motoristas: [] });
  const [mostrarSugestaoPlaca, setMostrarSugestaoPlaca] = useState(false);
  const [mostrarSugestaoMotorista, setMostrarSugestaoMotorista] = useState(false);

  const inputCameraRef = useRef();
  const inputArquivoRef = useRef();
  const inputDesktopRef = useRef();
  const progressoTimerRef = useRef(null);

  // Carregar recentes e prefill ao montar
  useEffect(() => {
    fetch(`${API}/devolucoes/recentes`)
      .then(r => r.json())
      .then(d => { if (d.placas) setRecentes(d); })
      .catch(() => {});

    const prefill = location.state?.prefill;
    if (prefill) {
      setForm({
        motorista:   prefill.motorista  || '',
        motivo:      prefill.motivo     || '',
        placa:       prefill.placa      || '',
        dt:          prefill.dt         || '',
        vendedor:    prefill.vendedor   || '',
        data:        hojeISO(),
        cliente:     prefill.cliente    || '',
        nf:          '',
        valor:       prefill.valor ? String(parseFloat(prefill.valor).toFixed(2)).replace('.', ',') : '',
        observacao:  prefill.observacao || ''
      });
      if (prefill.motivo) setMotivoSelect(MOTIVOS.includes(prefill.motivo) ? prefill.motivo : 'Outros');
    }
  }, []);

  // Mensagens rotativas durante leitura
  useEffect(() => {
    if (!lendo) return;
    setMsgIdx(0);
    const interval = setInterval(() => {
      setMsgIdx(i => (i + 1) % MENSAGENS_LOADING.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [lendo]);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => { if (progressoTimerRef.current) clearInterval(progressoTimerRef.current); };
  }, []);

  function set(campo, val) {
    setForm(f => ({ ...f, [campo]: val }));
  }

  function handleMotivoSelect(val) {
    setMotivoSelect(val);
    if (val && val !== 'Outros') {
      set('motivo', val);
    } else if (val === 'Outros') {
      if (!form.motivo || MOTIVOS.includes(form.motivo)) {
        set('motivo', '');
      }
    } else {
      set('motivo', '');
    }
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

  function limparCampos() {
    setForm(estadoInicial);
    setMotivoSelect('');
    setArquivo(null);
    setPreviewUrl('');
    setExtraido({ cliente: false, nf: false, valor: false, vendedor: false, dt: false });
    setErros([]);
    setErroDuplicada('');
    setLimpo(true);
    setTimeout(() => setLimpo(false), 2000);
  }

  function mostrarToast(mensagem, cor = '#16a34a') {
    setToast({ visivel: true, mensagem, cor });
    setTimeout(() => setToast({ visivel: false, mensagem: '', cor: '' }), 3000);
  }

  async function lerDocumento() {
    if (!arquivo) return;
    setLendo(true);
    setProgresso(0);
    setProgressoVisivel(true);

    let pct = 0;
    progressoTimerRef.current = setInterval(() => {
      pct += 1;
      if (pct >= 90) {
        clearInterval(progressoTimerRef.current);
        pct = 90;
      }
      setProgresso(pct);
    }, 89);

    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const resp = await fetch(`${API}/extrair-documento`, {
        method: 'POST',
        body: formData
      });
      const dados = await resp.json();

      clearInterval(progressoTimerRef.current);
      setProgresso(100);
      setTimeout(() => setProgressoVisivel(false), 400);

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
      clearInterval(progressoTimerRef.current);
      setProgressoVisivel(false);
      alert('Erro ao processar documento: ' + err.message);
    } finally {
      setLendo(false);
    }
  }

  function validar() {
    const lista = [];
    if (!form.motorista.trim()) lista.push('Motorista');
    if (!form.motivo.trim()) lista.push('Motivo da Devolução');
    if (!form.cliente.trim()) lista.push('Cliente');
    if (!form.nf.trim()) lista.push('NF');
    if (!form.data) lista.push('Data da Devolução');
    return lista;
  }

  function vibrar() {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  async function salvar() {
    const lista = validar();
    if (lista.length > 0) {
      setErros(lista);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErros([]);
    setErroDuplicada('');
    setSalvando(true);
    try {
      const resp = await fetch(`${API}/devolucoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data:       form.data,
          placa:      form.placa,
          dt:         form.dt,
          motorista:  form.motorista,
          vendedor:   form.vendedor,
          cliente:    form.cliente,
          nf:         form.nf.replace(/^0+/, ''),
          motivo:     form.motivo,
          valor:      form.valor,
          observacao: form.observacao
        })
      });

      if (resp.status === 409) {
        const err = await resp.json();
        setErroDuplicada(err.mensagem || 'NF já registrada.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const salvo = await resp.json();
      if (salvo.erro) {
        alert('Erro ao salvar: ' + salvo.erro);
        return;
      }

      vibrar();
      mostrarToast('Registro salvo com sucesso!');
      setTimeout(() => navigate(`/dia/${form.data}`), 1500);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  const sugestoesFiltPlaca = recentes.placas.filter(
    p => !form.placa || p.toLowerCase().includes(form.placa.toLowerCase())
  );
  const sugestoesFiltMotorista = recentes.motoristas.filter(
    m => !form.motorista || m.toLowerCase().includes(form.motorista.toLowerCase())
  );

  return (
    <div className="page">
      <Toast toast={toast} />

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

        {erroDuplicada && (
          <div className="banner-erro" style={{ marginBottom: 16 }}>
            <div className="banner-erro-titulo">NF já registrada</div>
            <div style={{ fontFamily: 'Barlow, sans-serif', fontSize: 13 }}>{erroDuplicada}</div>
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
                {progressoVisivel && (
                  <div
                    className="btn-ler-progresso"
                    style={{ width: `${progresso}%`, opacity: progresso < 100 ? 1 : 0 }}
                  />
                )}
                {lendo ? MENSAGENS_LOADING[msgIdx] : 'LER DOCUMENTO'}
              </button>
            )}
          </div>

          {/* COLUNA DIREITA — DADOS */}
          <div>
            <div className="coluna-titulo">Dados da Entrega</div>
            <div className="form-grid">

              <div className="form-grupo sugestoes-container">
                <label className="form-label form-label-obrigatorio">MOTORISTA</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.motorista}
                  onFocus={() => setMostrarSugestaoMotorista(true)}
                  onBlur={() => setTimeout(() => setMostrarSugestaoMotorista(false), 150)}
                  onChange={e => set('motorista', e.target.value)}
                />
                {mostrarSugestaoMotorista && sugestoesFiltMotorista.length > 0 && (
                  <div className="sugestoes-lista">
                    {sugestoesFiltMotorista.map(m => (
                      <div key={m} className="sugestoes-item" onMouseDown={() => set('motorista', m)}>
                        {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">MOTIVO DA DEVOLUÇÃO</label>
                <select
                  className="form-select"
                  value={motivoSelect}
                  onChange={e => handleMotivoSelect(e.target.value)}
                >
                  <option value="">Selecione o motivo...</option>
                  {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {motivoSelect === 'Outros' && (
                  <textarea
                    className="form-textarea"
                    style={{ marginTop: 8, minHeight: 80 }}
                    placeholder="Descreva o motivo..."
                    value={form.motivo}
                    onChange={e => set('motivo', e.target.value)}
                  />
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label">OBSERVAÇÃO</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 70 }}
                  placeholder="Observação adicional (opcional)..."
                  value={form.observacao}
                  onChange={e => set('observacao', e.target.value)}
                />
              </div>

              <div className="form-grupo sugestoes-container">
                <label className="form-label">PLACA</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.placa}
                  onFocus={() => setMostrarSugestaoPlaca(true)}
                  onBlur={() => setTimeout(() => setMostrarSugestaoPlaca(false), 150)}
                  onChange={e => set('placa', e.target.value)}
                />
                {mostrarSugestaoPlaca && sugestoesFiltPlaca.length > 0 && (
                  <div className="sugestoes-lista">
                    {sugestoesFiltPlaca.map(p => (
                      <div key={p} className="sugestoes-item" onMouseDown={() => set('placa', p)}>
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-grupo">
                <label className="form-label">DT</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.dt}
                  onChange={e => set('dt', e.target.value)}
                />
                {extraido.dt && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label">VENDEDOR</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.vendedor}
                  onChange={e => set('vendedor', e.target.value)}
                />
                {extraido.vendedor && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">DATA DA DEVOLUÇÃO</label>
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
                {extraido.cliente && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

              <div className="form-grupo">
                <label className="form-label form-label-obrigatorio">NF</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.nf}
                  onChange={e => { set('nf', e.target.value.replace(/^0+/, '')); setErroDuplicada(''); }}
                />
                {extraido.nf && <span className="badge-extraido">Extraído automaticamente</span>}
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
                {extraido.valor && <span className="badge-extraido">Extraído automaticamente</span>}
              </div>

            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-limpar-campos" onClick={limparCampos} type="button">
            LIMPAR CAMPOS
          </button>
          {limpo && <div className="msg-limpo">Campos limpos</div>}
          <button
            className="btn-primario"
            style={{ borderRadius: 8 }}
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
