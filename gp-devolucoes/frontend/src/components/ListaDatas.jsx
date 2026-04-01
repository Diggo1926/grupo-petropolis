import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return `${DIAS_SEMANA[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function ehHoje(dataStr) {
  return dataStr === hojeISO();
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarValorCurto(v) {
  const num = parseFloat(v) || 0;
  if (num >= 1000) {
    return 'R$ ' + (num / 1000).toFixed(1).replace('.', ',') + 'k';
  }
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ListaDatas() {
  const navigate = useNavigate();
  const [datas, setDatas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch(`${API}/devolucoes/datas`)
      .then(r => r.json())
      .then(dados => {
        setDatas(dados);
        setCarregando(false);
      })
      .catch(() => {
        setErro('Erro ao carregar dados. Verifique se o backend está rodando.');
        setCarregando(false);
      });
  }, []);

  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);

  const dadosHoje = datas.find(d => d.data === hoje);
  const qtdHoje = dadosHoje ? Number(dadosHoje.quantidade) : 0;
  const totalHoje = dadosHoje ? parseFloat(dadosHoje.total) || 0 : 0;
  const qtdMes = datas
    .filter(d => d.data && d.data.slice(0, 7) === mesAtual)
    .reduce((s, d) => s + Number(d.quantidade), 0);

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

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-valor">{qtdHoje}</div>
            <div className="stat-label">Hoje</div>
          </div>
          <div className="stat-card">
            <div className="stat-valor">{formatarValorCurto(totalHoje)}</div>
            <div className="stat-label">Total do dia</div>
          </div>
          <div className="stat-card">
            <div className="stat-valor">{qtdMes}</div>
            <div className="stat-label">Este mês</div>
          </div>
        </div>

        <div className="page-title">DEVOLUÇÕES</div>
        <div className="page-title-linha"></div>

        {erro && (
          <div className="banner-erro" style={{ marginBottom: 20 }}>
            <div className="banner-erro-titulo">{erro}</div>
          </div>
        )}

        {!erro && datas.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolução registrada</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para começar</div>
          </div>
        ) : (
          <div className="grid-datas">
            {datas.map(item => (
              <div
                key={item.data}
                className="card-data"
                onClick={() => navigate(`/dia/${item.data}`)}
              >
                <div className="card-data-header">
                  <span className="card-data-titulo">{formatarData(item.data)}</span>
                  {ehHoje(item.data) && <span className="badge-hoje">HOJE</span>}
                </div>
                <hr className="card-data-divisor" />
                <div className="card-data-footer">
                  <span className="card-data-qtd">
                    {item.quantidade} {Number(item.quantidade) === 1 ? 'registro' : 'registros'}
                  </span>
                  <span className="card-data-total">{formatarValor(item.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="btn-fixo">
        <button className="btn-primario" onClick={() => navigate('/nova')}>
          + NOVO REGISTRO
        </button>
      </div>
    </div>
  );
}
