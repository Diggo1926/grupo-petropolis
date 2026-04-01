import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

function formatarData(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const dias = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${dias[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function ehHoje(dataStr) {
  const hoje = new Date();
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return (
    hoje.getFullYear() === ano &&
    hoje.getMonth() + 1 === mes &&
    hoje.getDate() === dia
  );
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
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
        setErro('Erro ao carregar dados. Verifique se o backend esta rodando.');
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
        <h1 className="page-title">Devolucoes</h1>

        {erro && (
          <div className="banner-erro" style={{ marginBottom: 20 }}>
            <div className="banner-erro-titulo">{erro}</div>
          </div>
        )}

        {!erro && datas.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolucao registrada</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para comecar</div>
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
                  <span className="card-data-qtd">{item.quantidade} {Number(item.quantidade) === 1 ? 'registro' : 'registros'}</span>
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
