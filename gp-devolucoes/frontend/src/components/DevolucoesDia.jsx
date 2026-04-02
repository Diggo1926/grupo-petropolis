import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL;

const MOTIVOS = [
  'ENDEREÇO ERRADO',
  'PDV FECHADO',
  'FALTA DE PAGAMENTO',
  'DUPLICIDADE',
  'RECUSA',
  'OUTROS'
];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function badgeMotivo(motivo) {
  const m = (motivo || '').toUpperCase();
  if (m.includes('ENDERECO') || m.includes('ENDEREÇO')) return 'badge-motivo badge-endereco';
  if (m.includes('PDV'))         return 'badge-motivo badge-pdv';
  if (m.includes('PAGAMENTO'))   return 'badge-motivo badge-pagamento';
  if (m.includes('DUPLICIDADE')) return 'badge-motivo badge-duplicidade';
  if (m.includes('RECUSA'))      return 'badge-motivo badge-recusa';
  return 'badge-motivo badge-outros';
}

function formatarDataBR(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataExtenso(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return `${dias[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function FormEdicao({ registro, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    data:       registro.data ? registro.data.split('T')[0] : '',
    placa:      registro.placa     || '',
    dt:         registro.dt        || '',
    motorista:  registro.motorista || '',
    vendedor:   registro.vendedor  || '',
    cliente:    registro.cliente   || '',
    nf:         registro.nf        || '',
    motivo:     registro.motivo    || '',
    valor:      registro.valor ? String(parseFloat(registro.valor).toFixed(2)).replace('.', ',') : '',
    observacao: registro.observacao || ''
  });

  const [motivoSelect, setMotivoSelect] = useState(
    MOTIVOS.includes((registro.motivo || '').toUpperCase()) ? registro.motivo : 'OUTROS'
  );

  function set(campo, val) {
    setForm(f => ({ ...f, [campo]: val }));
  }

  function handleMotivoSelect(val) {
    setMotivoSelect(val);
    if (val && val !== 'OUTROS') set('motivo', val);
  }

  return (
    <div className="form-grid">
      <div className="form-grupo">
        <label className="form-label form-label-obrigatorio">DATA</label>
        <input className="form-input" type="date" value={form.data} onChange={e => set('data', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label form-label-obrigatorio">MOTORISTA</label>
        <input className="form-input" type="text" value={form.motorista} onChange={e => set('motorista', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label form-label-obrigatorio">MOTIVO DA DEVOLUÇÃO</label>
        <select className="form-select" value={motivoSelect} onChange={e => handleMotivoSelect(e.target.value)}>
          <option value="">Selecione ou escreva o motivo...</option>
          {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <textarea
          className="form-textarea"
          style={{ marginTop: 8, minHeight: 80 }}
          placeholder="Descreva o motivo ou complemento..."
          value={form.motivo}
          onChange={e => { set('motivo', e.target.value); setMotivoSelect(''); }}
        />
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
      <div className="form-grupo">
        <label className="form-label form-label-obrigatorio">CLIENTE</label>
        <input className="form-input" type="text" value={form.cliente} onChange={e => set('cliente', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label form-label-obrigatorio">NF</label>
        <input className="form-input" type="text" value={form.nf} onChange={e => set('nf', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label">PLACA</label>
        <input className="form-input" type="text" value={form.placa} onChange={e => set('placa', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label">DT</label>
        <input className="form-input" type="text" value={form.dt} onChange={e => set('dt', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label">VENDEDOR</label>
        <input className="form-input" type="text" value={form.vendedor} onChange={e => set('vendedor', e.target.value)} />
      </div>
      <div className="form-grupo">
        <label className="form-label">VALOR</label>
        <input className="form-input" type="text" placeholder="0,00" value={form.valor} onChange={e => set('valor', e.target.value)} />
      </div>
      <div className="modal-botoes">
        <button className="btn-cancelar" onClick={onCancelar}>Cancelar</button>
        <button className="btn-salvar" disabled={salvando} onClick={() => onSalvar(form)}>
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

export default function DevolucoesDia() {
  const { data } = useParams();
  const navigate = useNavigate();

  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [filtroDt, setFiltroDt] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroClienteInput, setFiltroClienteInput] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroNfInput, setFiltroNfInput] = useState('');
  const [filtroNf, setFiltroNf] = useState('');
  const [filtroMotivo, setFiltroMotivo] = useState('');
  const [toast, setToast] = useState({ visivel: false, mensagem: '', cor: '' });

  useEffect(() => {
    const t = setTimeout(() => setFiltroCliente(filtroClienteInput), 300);
    return () => clearTimeout(t);
  }, [filtroClienteInput]);

  useEffect(() => {
    const t = setTimeout(() => setFiltroNf(filtroNfInput), 300);
    return () => clearTimeout(t);
  }, [filtroNfInput]);

  useEffect(() => {
    fetch(`${API}/devolucoes?data=${data}`)
      .then(r => r.json())
      .then(dados => {
        setRegistros(Array.isArray(dados) ? dados : []);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, [data]);

  function mostrarToast(mensagem, cor = '#16a34a') {
    setToast({ visivel: true, mensagem, cor });
    setTimeout(() => setToast({ visivel: false, mensagem: '', cor: '' }), 4000);
  }

  async function salvarEdicao(form) {
    setSalvando(true);
    try {
      const resp = await fetch(`${API}/devolucoes/${editando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const atualizado = await resp.json();
      setRegistros(prev => prev.map(r => r.id === editando.id ? atualizado : r));
      setEditando(null);
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    setSalvando(true);
    try {
      const resp = await fetch(`${API}/devolucoes/${excluindo.id}`, { method: 'DELETE' });
      if (resp.ok) {
        setRegistros(prev => prev.filter(r => r.id !== excluindo.id));
        setExcluindo(null);
      } else {
        alert('Erro ao excluir registro.');
      }
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setSalvando(false);
    }
  }

  function duplicarRegistro(r) {
    navigate('/nova', {
      state: {
        prefill: {
          motorista:  r.motorista,
          motivo:     r.motivo,
          placa:      r.placa,
          dt:         r.dt,
          vendedor:   r.vendedor,
          cliente:    r.cliente,
          valor:      r.valor,
          observacao: r.observacao,
          nf:         '',
          data:       hojeISO()
        }
      }
    });
  }

  function exportarExcel() {
    const lista = registrosFiltrados;
    const wb = XLSX.utils.book_new();
    const aoa = [];

    aoa.push(['PLANILHA DE DEVOLUCAO DIARIA CD- ITABAIANA', '', '', '', '', '', '', '', '']);
    aoa.push(['DATA', 'PLACA', 'DT', 'MOTORISTA', 'VENDEDOR', 'CLIENTE', 'NF', 'MOTIVO DA DEVOLUCAO', 'VALOR']);

    lista.forEach(r => {
      const dataFmt = r.data ? formatarDataBR(r.data.split('T')[0]) : '';
      const valorFmt = `R$ ${parseFloat(r.valor || 0).toFixed(2).replace('.', ',')}`;
      aoa.push([dataFmt, r.placa || '', r.dt || '', r.motorista, r.vendedor || '', r.cliente, r.nf, r.motivo, valorFmt]);
    });

    aoa.push(['', '', '', '', '', '', '', '', '']);
    const totalValor = lista.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
    aoa.push(['', '', '', '', '', '', 'TOTAL', String(lista.length), `R$ ${totalValor.toFixed(2).replace('.', ',')}`]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
    ws['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
      { wch: 35 }, { wch: 12 }, { wch: 25 }, { wch: 14 }
    ];

    const estiloTitulo = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'CC0000' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const estiloCabecalho = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1A1A1A' } },
      alignment: { horizontal: 'center' }
    };

    const cols = ['A','B','C','D','E','F','G','H','I'];
    cols.forEach(c => { if (ws[`${c}1`]) ws[`${c}1`].s = estiloTitulo; });
    if (!ws['A1']) ws['A1'] = { v: 'PLANILHA DE DEVOLUCAO DIARIA CD- ITABAIANA', s: estiloTitulo };
    else ws['A1'].s = estiloTitulo;
    cols.forEach(c => { if (ws[`${c}2`]) ws[`${c}2`].s = estiloCabecalho; });
    lista.forEach((_, i) => {
      const row = i + 3;
      const cor = i % 2 === 0 ? 'FFFFFF' : 'FFF5F5';
      cols.forEach(c => {
        const ref = `${c}${row}`;
        if (!ws[ref]) ws[ref] = { v: '' };
        ws[ref].s = { fill: { fgColor: { rgb: cor } } };
      });
    });

    const [ano, mes, dia] = data.split('-');
    XLSX.utils.book_append_sheet(wb, ws, `DEV ${dia}.${mes}`);
    XLSX.writeFile(wb, `DEV_${dia}-${mes}-${ano}.xlsx`);

    mostrarToast(
      `Excel exportado com ${lista.length} registro${lista.length !== 1 ? 's' : ''} | Total: ${formatarValor(totalValor)}`,
      '#1F3864'
    );
  }

  // ─── Filtros e contadores ────────────────────────────────
  const dtsUnicos       = [...new Set(registros.map(r => r.dt).filter(Boolean))].sort();
  const placasUnicas    = [...new Set(registros.map(r => r.placa).filter(Boolean))].sort();
  const motoristasUnicos = [...new Set(registros.map(r => r.motorista).filter(Boolean))].sort();
  const vendedoresUnicos = [...new Set(registros.map(r => r.vendedor).filter(Boolean))].sort();

  const registrosFiltrados = registros
    .filter(r => !filtroDt        || r.dt === filtroDt)
    .filter(r => !filtroPlaca     || r.placa === filtroPlaca)
    .filter(r => !filtroMotorista || r.motorista === filtroMotorista)
    .filter(r => !filtroVendedor  || r.vendedor === filtroVendedor)
    .filter(r => !filtroCliente   || (r.cliente || '').toUpperCase().includes(filtroCliente.toUpperCase()))
    .filter(r => !filtroNf        || (r.nf || '').includes(filtroNf))
    .filter(r => !filtroMotivo    || (r.motivo || '').toUpperCase().includes(filtroMotivo.toUpperCase()));

  const totalFiltrado = registrosFiltrados.reduce((s, r) => s + parseFloat(r.valor || 0), 0);

  const temFiltro = filtroDt || filtroPlaca || filtroMotorista || filtroVendedor ||
                    filtroClienteInput || filtroNfInput || filtroMotivo;

  function limparFiltros() {
    setFiltroDt('');
    setFiltroPlaca('');
    setFiltroMotorista('');
    setFiltroVendedor('');
    setFiltroClienteInput('');
    setFiltroCliente('');
    setFiltroNfInput('');
    setFiltroNf('');
    setFiltroMotivo('');
  }

  if (carregando) {
    return (
      <div className="page">
        <div className="container">
          <p className="loading-texto">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Toast toast={toast} />

      <div className="container">
        <div className="tela-header">
          <button className="btn-voltar" onClick={() => navigate(`/mes/${data.substring(0, 7)}`)}>
            &#8592; Voltar
          </button>
          <span className="tela-header-titulo">{formatarDataExtenso(data)}</span>
          <button className="btn-exportar" onClick={exportarExcel}>
            Exportar Excel
          </button>
        </div>

        {/* Filtros */}
        {registros.length > 0 && (
          <>
            <div className="filtros-barra" style={{ flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 4 }}>
              {dtsUnicos.length > 0 && (
                <select className="filtros-select" style={{ minWidth: 100 }} value={filtroDt} onChange={e => setFiltroDt(e.target.value)}>
                  <option value="">DT</option>
                  {dtsUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              {placasUnicas.length > 0 && (
                <select className="filtros-select" style={{ minWidth: 110 }} value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}>
                  <option value="">Placa</option>
                  {placasUnicas.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              <select className="filtros-select" style={{ minWidth: 140 }} value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}>
                <option value="">Motorista</option>
                {motoristasUnicos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              {vendedoresUnicos.length > 0 && (
                <select className="filtros-select" style={{ minWidth: 140 }} value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
                  <option value="">Vendedor</option>
                  {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              <input
                className="filtros-select"
                style={{ minWidth: 130 }}
                type="text"
                placeholder="Cliente..."
                value={filtroClienteInput}
                onChange={e => setFiltroClienteInput(e.target.value)}
              />
              <input
                className="filtros-select"
                style={{ minWidth: 100 }}
                type="text"
                placeholder="NF..."
                value={filtroNfInput}
                onChange={e => setFiltroNfInput(e.target.value)}
              />
              <select className="filtros-select" style={{ minWidth: 140 }} value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)}>
                <option value="">Motivo</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="filtros-contador">
                Mostrando {registrosFiltrados.length} de {registros.length} &middot; {formatarValor(totalFiltrado)}
              </span>
              {temFiltro && (
                <button className="btn-limpar-filtros" onClick={limparFiltros}>
                  Limpar filtros
                </button>
              )}
            </div>
          </>
        )}

        {registrosFiltrados.length === 0 && registros.length > 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhum registro com este filtro</div>
            <div className="estado-vazio-sub">Ajuste ou limpe os filtros acima</div>
          </div>
        ) : registros.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolução neste dia</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para adicionar</div>
          </div>
        ) : (
          registrosFiltrados.map(r => (
            <div key={r.id} className="card-registro">
              <div className="card-registro-linha1">
                <span className="card-registro-cliente">{r.cliente}</span>
                <span className={badgeMotivo(r.motivo)}>{r.motivo}</span>
              </div>
              <div className="card-registro-linha2">
                <span className="card-registro-info">NF: {r.nf}</span>
                <span className="card-registro-info">Motorista: {r.motorista}</span>
              </div>
              <div className="card-registro-linha3">
                <span className="card-registro-valor">{formatarValor(r.valor)}</span>
                <div className="card-registro-meta">
                  {r.placa && <span className="card-registro-info">Placa: {r.placa}</span>}
                  {r.dt    && <span className="card-registro-info">DT: {r.dt}</span>}
                </div>
              </div>
              {r.vendedor && (
                <div className="card-registro-linha4">
                  <span className="card-registro-info">Vendedor: {r.vendedor}</span>
                </div>
              )}
              {r.observacao && (
                <div className="card-registro-obs">{r.observacao}</div>
              )}
              <div className="card-registro-footer">
                <button className="btn-editar"  onClick={() => setEditando(r)}>Editar</button>
                <button className="btn-excluir" onClick={() => setExcluindo(r)}>Excluir</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="btn-fixo">
        <button className="btn-primario" onClick={() => navigate('/nova')}>
          + NOVO REGISTRO
        </button>
      </div>

      {/* Modal Edição */}
      {editando && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-titulo">Editar Devolução</span>
              <button className="modal-fechar" onClick={() => setEditando(null)}>&#10005;</button>
            </div>
            <FormEdicao
              registro={editando}
              onSalvar={salvarEdicao}
              onCancelar={() => setEditando(null)}
              salvando={salvando}
            />
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {excluindo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setExcluindo(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-titulo">Excluir Devolução</span>
              <button className="modal-fechar" onClick={() => setExcluindo(null)}>&#10005;</button>
            </div>
            <p style={{ fontFamily: 'Barlow, sans-serif', fontSize: 15, marginBottom: 6 }}>
              Tem certeza que deseja excluir este registro?
            </p>
            <p className="modal-aviso">Esta ação não pode ser desfeita.</p>
            <div className="modal-botoes">
              <button className="btn-cancelar" onClick={() => setExcluindo(null)}>Cancelar</button>
              <button className="btn-excluir-confirmar" disabled={salvando} onClick={confirmarExclusao}>
                {salvando ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
