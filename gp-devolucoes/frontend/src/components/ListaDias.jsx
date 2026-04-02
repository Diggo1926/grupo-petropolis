import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarDia(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return `${DIAS_SEMANA[d.getDay()]}, ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarMesTitulo(mesStr) {
  const [ano, mes] = mesStr.split('-').map(Number);
  return `${NOMES_MESES[mes - 1].toUpperCase()} ${ano}`;
}

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ListaDias() {
  const { mes } = useParams();
  const navigate = useNavigate();
  const [dias, setDias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const hoje = hojeISO();

  useEffect(() => {
    fetch(`${API}/devolucoes/dias?mes=${mes}`)
      .then(r => r.json())
      .then(dados => {
        setDias(Array.isArray(dados) ? dados : []);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
  }, [mes]);

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
          <span className="tela-header-titulo">{formatarMesTitulo(mes)}</span>
        </div>

        {dias.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolução neste mês</div>
            <div className="estado-vazio-sub">Clique em Novo Registro para adicionar</div>
          </div>
        ) : (
          <div className="grid-datas">
            {dias.map(item => (
              <div
                key={item.data}
                className="card-data"
                onClick={() => navigate(`/dia/${item.data}`)}
              >
                <div className="card-data-header">
                  <span className="card-data-titulo">{formatarDia(item.data)}</span>
                  {item.data === hoje && <span className="badge-hoje">HOJE</span>}
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
