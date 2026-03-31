import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatarDataExibicao(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return `${diasSemana[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

function formatarValor(v) {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function exportarExcel(registros, data) {
  const [ano, mes, dia] = data.split('-');

  const wb = XLSX.utils.book_new();
  const ws = {};

  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const headers = ['DATA', 'PLACA', 'DT', 'MOTORISTA', 'VENDEDOR', 'CLIENTE', 'NF', 'MOTIVO DA DEVOLUCAO', 'VALOR'];

  // Linha 1 - Titulo mesclado
  ws['A1'] = {
    v: 'PLANILHA DE DEVOLUCAO DIARIA CD- ITABAIANA',
    s: {
      fill: { fgColor: { rgb: 'CC0000' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    },
  };

  // Linha 2 - Cabecalhos
  headers.forEach((h, i) => {
    ws[`${cols[i]}2`] = {
      v: h,
      s: {
        fill: { fgColor: { rgb: '111111' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
      },
    };
  });

  // Linhas de dados
  registros.forEach((r, idx) => {
    const row = idx + 3;
    const [a, m, d2] = r.data.split('-');
    ws[`A${row}`] = { v: `${d2}/${m}/${a}` };
    ws[`B${row}`] = { v: r.placa || '' };
    ws[`C${row}`] = { v: r.dt || '' };
    ws[`D${row}`] = { v: r.motorista || '' };
    ws[`E${row}`] = { v: r.vendedor || '' };
    ws[`F${row}`] = { v: r.cliente || '' };
    ws[`G${row}`] = { v: r.nf || '' };
    ws[`H${row}`] = { v: r.motivo || '' };
    ws[`I${row}`] = {
      v: `R$ ${parseFloat(r.valor || 0).toFixed(2).replace('.', ',')}`,
    };
  });

  // Linha de total
  const totalRow = registros.length + 3;
  const soma = registros.reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);
  ws[`A${totalRow}`] = { v: 'TOTAL', s: { font: { bold: true } } };
  ws[`B${totalRow}`] = { v: registros.length, s: { font: { bold: true } } };
  ws[`I${totalRow}`] = {
    v: `R$ ${soma.toFixed(2).replace('.', ',')}`,
    s: { font: { bold: true } },
  };

  // Merge A1:I1
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  // Largura das colunas
  ws['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
    { wch: 32 }, { wch: 12 }, { wch: 24 }, { wch: 14 },
  ];

  ws['!ref'] = `A1:I${totalRow}`;

  const nomeAba = `DEV ${dia}.${mes}`;
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  XLSX.writeFile(wb, `DEV_${dia}-${mes}-${ano}.xlsx`);
}

export default function DevolucoesDia() {
  const { data } = useParams();
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setLoading(true);
    fetch(`${API}/devolucoes?data=${data}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) setErro(d.erro);
        else setRegistros(d);
      })
      .catch(() => setErro('Nao foi possivel carregar os registros.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
  }, [data]);

  const remover = async (id) => {
    if (!confirm('Remover esta devolucao?')) return;
    try {
      const r = await fetch(`${API}/devolucoes/${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.erro) return alert(d.erro);
      carregar();
    } catch {
      alert('Erro ao remover registro.');
    }
  };

  const total = registros.reduce((acc, r) => acc + parseFloat(r.valor || 0), 0);

  return (
    <div>
      <div className="app-header">
        <button className="btn-back" onClick={() => navigate('/')}>&#8592;</button>
        <div>
          <h1>Devolucoes do Dia</h1>
          <p>{data ? formatarDataExibicao(data) : ''}</p>
        </div>
      </div>

      <div className="content">
        {erro && <div className="error-msg">{erro}</div>}

        {loading ? (
          <div className="loading-screen">Carregando...</div>
        ) : (
          <>
            {registros.length > 0 && (
              <div className="totals-row">
                <span>{registros.length} registro{registros.length !== 1 ? 's' : ''}</span>
                <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            )}

            {registros.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: '2rem' }}>—</p>
                <p>Nenhuma devolucao registrada neste dia.</p>
              </div>
            ) : (
              registros.map((r) => (
                <div key={r.id} className="card">
                  <div className="card-cliente">{r.cliente || '—'}</div>
                  <div className="card-nf-valor">
                    <span className="card-nf">NF {r.nf || '—'}</span>
                    <span className="card-valor">
                      {parseFloat(r.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="card-row">
                    {r.motivo && <span className="card-field"><strong>Motivo:</strong> {r.motivo}</span>}
                    {r.placa && <span className="card-field"><strong>Placa:</strong> {r.placa}</span>}
                    {r.motorista && <span className="card-field"><strong>Motorista:</strong> {r.motorista}</span>}
                    {r.vendedor && <span className="card-field"><strong>Vendedor:</strong> {r.vendedor}</span>}
                    {r.dt && <span className="card-field"><strong>DT:</strong> {r.dt}</span>}
                  </div>
                  <div className="card-actions">
                    <button className="btn-delete" onClick={() => remover(r.id)}>Remover</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      <div className="footer-bar" style={{ left: 0, right: 0, bottom: 0, position: 'fixed', background: '#fff', padding: '12px 16px', boxShadow: '0 -2px 8px rgba(0,0,0,0.08)', display: 'flex', gap: '10px', maxWidth: '640px', margin: '0 auto' }}>
        <button
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => exportarExcel(registros, data)}
          disabled={registros.length === 0}
        >
          Exportar Excel
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          onClick={() => navigate(`/nova/${data}`)}
        >
          + Nova Devolucao
        </button>
      </div>
    </div>
  );
}
