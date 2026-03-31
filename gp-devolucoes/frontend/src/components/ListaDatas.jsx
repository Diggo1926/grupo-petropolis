import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  return `${diasSemana[d.getDay()]}, ${dia}/${mes}/${ano}`;
}

function formatarValor(v) {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataHoje() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export default function ListaDatas() {
  const [datas, setDatas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();
  const hoje = dataHoje();

  useEffect(() => {
    fetch(`${API}/devolucoes/datas`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erro) setErro(data.erro);
        else setDatas(data);
      })
      .catch(() => setErro('Nao foi possivel conectar ao servidor.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="app-header">
        <div>
          <h1>GP Logistica</h1>
          <p>Devolucoes</p>
        </div>
      </div>

      <div className="content">
        {erro && <div className="error-msg">{erro}</div>}

        {loading ? (
          <div className="loading-screen">Carregando...</div>
        ) : datas.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '2rem' }}>—</p>
            <p>Nenhum registro encontrado.</p>
            <p>Clique em "Nova Devolucao" para comecar.</p>
          </div>
        ) : (
          datas.map((item) => (
            <div
              key={item.data}
              className={`card ${item.data === hoje ? 'card-hoje' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/dia/${item.data}`)}
            >
              <div className="card-date">
                {formatarData(item.data)}
                {item.data === hoje && <span className="badge">Hoje</span>}
              </div>
              <div className="card-meta">
                <span>{item.quantidade} devolucao{item.quantidade != 1 ? 'es' : ''}</span>
                <span className="card-total">{formatarValor(item.total)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => navigate('/nova')}>
        + Nova Devolucao
      </button>
    </div>
  );
}
