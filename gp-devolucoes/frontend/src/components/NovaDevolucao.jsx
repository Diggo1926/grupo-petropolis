import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function dataHoje() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

const MOTIVOS = [
  'ENDERECO ERRADO',
  'PDV FECHADO',
  'FALTA DE PAGAMENTO',
  'DUPLICIDADE',
  'RECUSA',
  'OUTROS',
];

export default function NovaDevolucao() {
  const navigate = useNavigate();
  const { data: dataParam } = useParams();
  const fileRef = useRef(null);

  const [imagem, setImagem] = useState(null);
  const [imagemBase64, setImagemBase64] = useState('');
  const [imagemMime, setImagemMime] = useState('');
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    data: dataParam || dataHoje(),
    placa: '',
    dt: '',
    motorista: '',
    vendedor: '',
    cliente: '',
    nf: '',
    motivo: '',
    valor: '',
  });

  const [autoFields, setAutoFields] = useState({ cliente: false, nf: false, valor: false });

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErro('');
    const url = URL.createObjectURL(file);
    setImagem(url);
    setImagemMime(file.type);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result.split(',')[1];
      setImagemBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const lerDocumento = async () => {
    if (!imagemBase64) return;
    setLendo(true);
    setErro('');
    try {
      const r = await fetch(`${API}/extrair-documento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagem: imagemBase64, mimeType: imagemMime }),
      });
      const d = await r.json();
      if (d.erro) {
        setErro(d.erro);
        return;
      }
      setForm((prev) => ({
        ...prev,
        cliente: d.cliente || prev.cliente,
        nf: d.nf || prev.nf,
        valor: d.valor || prev.valor,
      }));
      setAutoFields({
        cliente: !!d.cliente,
        nf: !!d.nf,
        valor: !!d.valor,
      });
    } catch {
      setErro('Erro ao conectar com o servidor.');
    } finally {
      setLendo(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const salvar = async () => {
    if (!form.data) {
      setErro('Informe a data.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const r = await fetch(`${API}/devolucoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (d.erro) {
        setErro(d.erro);
        return;
      }
      navigate(`/dia/${form.data}`);
    } catch {
      setErro('Erro ao salvar registro.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="app-header">
        <button className="btn-back" onClick={() => navigate(-1)}>&#8592;</button>
        <div>
          <h1>Nova Devolucao</h1>
          <p>Preencha os dados do registro</p>
        </div>
      </div>

      <div className="content">
        {erro && <div className="error-msg">{erro}</div>}

        {/* Upload */}
        <div className="section-title">Documento (opcional)</div>
        <div
          className="upload-area"
          onClick={() => fileRef.current.click()}
        >
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleFile}
          />
          {imagem ? (
            <img src={imagem} alt="Preview" className="preview-img" />
          ) : (
            <p>Toque para <strong>selecionar foto</strong> da nota fiscal</p>
          )}
        </div>

        {imagemBase64 && (
          <button
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={lerDocumento}
            disabled={lendo}
          >
            {lendo ? 'Lendo...' : 'Ler Documento'}
          </button>
        )}

        {lendo && <div className="loading-text">Lendo documento...</div>}

        {/* Campos extraidos pela IA */}
        <div className="section-title">Dados do Documento</div>

        <div className="form-group">
          <label className="form-label">
            CLIENTE
            {autoFields.cliente && <span className="badge badge-auto">Auto</span>}
          </label>
          <input
            className="form-input"
            type="text"
            name="cliente"
            value={form.cliente}
            onChange={handleChange}
            placeholder="Nome do cliente"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            NF
            {autoFields.nf && <span className="badge badge-auto">Auto</span>}
          </label>
          <input
            className="form-input"
            type="text"
            name="nf"
            value={form.nf}
            onChange={handleChange}
            placeholder="Numero da nota fiscal"
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            VALOR
            {autoFields.valor && <span className="badge badge-auto">Auto</span>}
          </label>
          <input
            className="form-input"
            type="text"
            name="valor"
            value={form.valor}
            onChange={handleChange}
            placeholder="0,00"
          />
        </div>

        {/* Campos manuais */}
        <div className="section-title">Dados da Entrega</div>

        <div className="form-group">
          <label className="form-label">DATA</label>
          <input
            className="form-input"
            type="date"
            name="data"
            value={form.data}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label className="form-label">PLACA</label>
          <input
            className="form-input"
            type="text"
            name="placa"
            value={form.placa}
            onChange={handleChange}
            placeholder="Ex: ABC-1234"
          />
        </div>

        <div className="form-group">
          <label className="form-label">DT</label>
          <input
            className="form-input"
            type="text"
            name="dt"
            value={form.dt}
            onChange={handleChange}
            placeholder="Numero DT"
          />
        </div>

        <div className="form-group">
          <label className="form-label">MOTORISTA</label>
          <input
            className="form-input"
            type="text"
            name="motorista"
            value={form.motorista}
            onChange={handleChange}
            placeholder="Nome do motorista"
          />
        </div>

        <div className="form-group">
          <label className="form-label">VENDEDOR</label>
          <input
            className="form-input"
            type="text"
            name="vendedor"
            value={form.vendedor}
            onChange={handleChange}
            placeholder="Nome do vendedor"
          />
        </div>

        <div className="form-group">
          <label className="form-label">MOTIVO DA DEVOLUCAO</label>
          <select
            className="form-select"
            name="motivo"
            value={form.motivo}
            onChange={handleChange}
          >
            <option value="">Selecione o motivo</option>
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 8, marginBottom: 40 }}
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
