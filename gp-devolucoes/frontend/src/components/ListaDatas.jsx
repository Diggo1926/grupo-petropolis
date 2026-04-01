import React, { useEffect, useState, useRef } from 'react';
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

  const [busca, setBusca] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const buscaRef = useRef(null);

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

  // Busca com debounce
  useEffect(() => {
    if (!busca.trim()) {
      setResultadosBusca([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API}/devolucoes/busca?q=${encodeURIComponent(busca.trim())}`)
        .then(r => r.json())
        .then(dados => setResultadosBusca(Array.isArray(dados) ? dados : []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [busca]);

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

        {/* BUSCA */}
        <div className="busca-container" ref={buscaRef}>
          <div className="busca-input-wrapper">
            <div className="busca-lupa" />
            <input
              className="busca-input"
              type="text"
              placeholder="Buscar por cliente ou NF..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {busca.trim() && resultadosBusca.length > 0 && (
            <div className="busca-resultados">
              {resultadosBusca.map(r => (
                <div
                  key={r.id}
                  className="busca-resultado-item"
                  onClick={() => { navigate(`/dia/${r.data}`); setBusca(''); }}
                >
                  <div className="busca-resultado-cliente">{r.cliente}</div>
                  <div className="busca-resultado-meta">
                    <span>NF: {r.nf}</span>
                    <span>{r.data ? r.data.split('T')[0].split('-').reverse().join('/') : ''}</span>
                    <span className="busca-resultado-valor">{formatarValor(r.valor)}</span>
                    <span>{r.motivo}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {busca.trim() && resultadosBusca.length === 0 && (
            <div className="busca-resultados">
              <div className="busca-resultado-item" style={{ cursor: 'default', color: 'var(--cinza-texto)' }}>
                <div style={{ fontFamily: 'Barlow, sans-serif', fontSize: 13 }}>Nenhum resultado encontrado</div>
              </div>
            </div>
          )}
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
