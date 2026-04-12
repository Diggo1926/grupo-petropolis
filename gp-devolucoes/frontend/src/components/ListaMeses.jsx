import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatarMes(mesStr) {
  const [ano, mes] = mesStr.split('-').map(Number);
  return `${NOMES_MESES[mes - 1].toUpperCase()} ${ano}`;
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ListaMeses() {
  const navigate = useNavigate();
  const [meses, setMeses] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const mesAtual = mesAtualISO();

  useEffect(() => {
    fetch(`${API}/devolucoes/meses`)
      .then(r => r.json())
      .then(dados => {
        setMeses(Array.isArray(dados) ? dados : []);
        setCarregando(false);
      })
      .catch(() => {
        setErro('Erro ao carregar dados. Verifique se o backend está rodando.');
        setCarregando(false);
      });
  }, []);

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
        <div className="page-title">DEVOLUÇÕES</div>
        <div className="page-title-linha"></div>

        {erro && (
          <div className="banner-erro" style={{ marginBottom: 20 }}>
            <div className="banner-erro-titulo">{erro}</div>
          </div>
        )}

        {!erro && meses.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolução registrada</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para começar</div>
          </div>
        ) : (
          <div className="grid-datas">
            {meses.map(item => (
              <div
                key={item.mes}
                className="card-data"
                onClick={() => navigate(`/mes/${item.mes}`)}
              >
                <div className="card-data-header">
                  <span className="card-data-titulo">{formatarMes(item.mes)}</span>
                  {item.mes === mesAtual && (
                    <span className="badge-hoje">MÊS ATUAL</span>
                  )}
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

      <div className="btn-fixo" style={{ display: 'flex', gap: 10 }}>
        <button
          className="btn-primario"
          style={{ flex: 1, background: '#CC0000', borderColor: '#CC0000' }}
          onClick={() => navigate('/ranking')}
        >
          🏆 RANKING
        </button>
        <button
          className="btn-primario"
          style={{ flex: 2 }}
          onClick={() => navigate('/nova')}
        >
          + NOVO REGISTRO
        </button>
      </div>
    </div>
  );
}
