import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL;

const MOTIVOS = [
  'ENDERECO ERRADO',
  'PDV FECHADO',
  'FALTA DE PAGAMENTO',
  'DUPLICIDADE',
  'RECUSA',
  'OUTROS'
];

function badgeMotivo(motivo) {
  const m = (motivo || '').toUpperCase();
  if (m.includes('ENDERECO')) return 'badge-motivo badge-endereco';
  if (m.includes('PDV')) return 'badge-motivo badge-pdv';
  if (m.includes('PAGAMENTO')) return 'badge-motivo badge-pagamento';
  if (m.includes('DUPLICIDADE')) return 'badge-motivo badge-duplicidade';
  if (m.includes('RECUSA')) return 'badge-motivo badge-recusa';
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
  const dias = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  return `${dias[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FormEdicao({ registro, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    data: registro.data ? registro.data.split('T')[0] : '',
    placa: registro.placa || '',
    dt: registro.dt || '',
    motorista: registro.motorista || '',
    vendedor: registro.vendedor || '',
    cliente: registro.cliente || '',
    nf: registro.nf || '',
    motivo: registro.motivo || '',
    valor: registro.valor ? String(parseFloat(registro.valor).toFixed(2)).replace('.', ',') : ''
  });

  const [motivoOutros, setMotivoOutros] = useState(
    !MOTIVOS.includes((registro.motivo || '').toUpperCase()) && registro.motivo ? registro.motivo : ''
  );
  const [usandoOutros, setUsandoOutros] = useState(
    !MOTIVOS.slice(0, 5).includes((registro.motivo || '').toUpperCase())
  );

  function set(campo, val) {
    setForm(f => ({ ...f, [campo]: val }));
  }

  function handleMotivo(val) {
    if (val === 'OUTROS') {
      setUsandoOutros(true);
      set('motivo', motivoOutros || 'OUTROS');
    } else {
      setUsandoOutros(false);
      setMotivoOutros('');
      set('motivo', val);
    }
  }

  function handleMotivoOutros(val) {
    setMotivoOutros(val);
    set('motivo', val || 'OUTROS');
  }

  const motivoSelect = usandoOutros ? 'OUTROS' : form.motivo;

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
        <label className="form-label form-label-obrigatorio">MOTIVO DA DEVOLUCAO</label>
        <select className="form-select" value={motivoSelect} onChange={e => handleMotivo(e.target.value)}>
          <option value="">Selecione o motivo...</option>
          {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {usandoOutros && (
          <textarea
            className="form-textarea"
            style={{ marginTop: 8 }}
            placeholder="Descreva o motivo"
            value={motivoOutros}
            onChange={e => handleMotivoOutros(e.target.value)}
          />
        )}
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
        <input className="form-input" type="number" value={form.dt} onChange={e => set('dt', e.target.value)} />
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
        <button
          className="btn-salvar"
          disabled={salvando}
          onClick={() => onSalvar(form)}
        >
          {salvando ? 'Salvando...' : 'Salvar alteracoes'}
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

  useEffect(() => {
    fetch(`${API}/devolucoes?data=${data}`)
      .then(r => r.json())
      .then(dados => {
        setRegistros(dados);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, [data]);

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

  function exportarExcel() {
    const wb = XLSX.utils.book_new();

    const aoa = [];

    // Linha 1: título mesclado
    aoa.push(['PLANILHA DE DEVOLUCAO DIARIA CD- ITABAIANA', '', '', '', '', '', '', '', '']);
    // Linha 2: cabeçalhos
    aoa.push(['DATA', 'PLACA', 'DT', 'MOTORISTA', 'VENDEDOR', 'CLIENTE', 'NF', 'MOTIVO DA DEVOLUCAO', 'VALOR']);

    registros.forEach(r => {
      const dataFmt = r.data ? formatarDataBR(r.data.split('T')[0]) : '';
      const valorFmt = `R$ ${parseFloat(r.valor || 0).toFixed(2).replace('.', ',')}`;
      aoa.push([dataFmt, r.placa || '', r.dt || '', r.motorista, r.vendedor || '', r.cliente, r.nf, r.motivo, valorFmt]);
    });

    // Linha em branco
    aoa.push(['', '', '', '', '', '', '', '', '']);

    // Total
    const totalValor = registros.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
    const totalFmt = `R$ ${totalValor.toFixed(2).replace('.', ',')}`;
    aoa.push(['', '', '', '', '', '', 'TOTAL', String(registros.length), totalFmt]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Mesclar A1:I1
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 20 },
      { wch: 35 }, { wch: 12 }, { wch: 25 }, { wch: 14 }
    ];

    // Estilos
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
    const estiloTotal = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'F3F4F6' } }
    };

    const cols = ['A','B','C','D','E','F','G','H','I'];

    // Aplicar estilo no título
    cols.forEach(c => {
      const cell = ws[`${c}1`];
      if (cell) cell.s = estiloTitulo;
    });
    if (!ws['A1']) ws['A1'] = { v: 'PLANILHA DE DEVOLUCAO DIARIA CD- ITABAIANA', s: estiloTitulo };
    else ws['A1'].s = estiloTitulo;

    // Cabeçalhos
    cols.forEach(c => {
      const cell = ws[`${c}2`];
      if (cell) cell.s = estiloCabecalho;
    });

    // Linhas de dados com cores alternadas
    registros.forEach((_, i) => {
      const row = i + 3;
      const cor = i % 2 === 0 ? 'FFFFFF' : 'FFF5F5';
      cols.forEach(c => {
        const ref = `${c}${row}`;
        if (!ws[ref]) ws[ref] = { v: '' };
        ws[ref].s = { fill: { fgColor: { rgb: cor } } };
      });
    });

    // Total
    const totalRow = registros.length + 4;
    cols.forEach(c => {
      const ref = `${c}${totalRow}`;
      if (!ws[ref]) ws[ref] = { v: '' };
      ws[ref].s = estiloTotal;
    });

    // Nome da aba
    const [ano, mes, dia] = data.split('-');
    const nomeAba = `DEV ${dia}.${mes}`;
    const nomeArquivo = `DEV_${dia}-${mes}-${ano}.xlsx`;

    XLSX.utils.book_append_sheet(wb, ws, nomeAba);
    XLSX.writeFile(wb, nomeArquivo);
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
      <div className="container">
        <div className="tela-header">
          <button className="btn-voltar" onClick={() => navigate('/')}>
            &#8592; Voltar
          </button>
          <span className="tela-header-titulo">{formatarDataExtenso(data)}</span>
          <button className="btn-exportar" onClick={exportarExcel}>
            Exportar Excel
          </button>
        </div>

        {registros.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolucao neste dia</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para adicionar</div>
          </div>
        ) : (
          registros.map(r => (
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
                <span className="card-registro-data">{formatarDataBR(r.data ? r.data.split('T')[0] : '')}</span>
              </div>
              <div className="card-registro-linha4">
                {r.placa && <span className="card-registro-info" style={{ fontSize: 12 }}>Placa: {r.placa}</span>}
                {r.dt && <span className="card-registro-info" style={{ fontSize: 12 }}>DT: {r.dt}</span>}
              </div>
              <div className="card-registro-footer">
                <button className="btn-editar" onClick={() => setEditando(r)}>Editar</button>
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
            <div className="modal-titulo">Editar Devolucao</div>
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
            <div className="modal-titulo">Excluir Devolucao</div>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Tem certeza que deseja excluir?</p>
            <p className="modal-aviso">Esta acao nao pode ser desfeita.</p>
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
