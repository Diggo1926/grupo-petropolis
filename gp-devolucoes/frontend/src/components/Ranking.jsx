import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL;

function formatarValor(v) {
  const num = parseFloat(v) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function iniciais(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const PODIO_CONFIG = {
  1: { cor: '#FFD700', fundo: '#2a2000', borda: '#B8860B', label: '1º' },
  2: { cor: '#C0C0C0', fundo: '#1e1e1e', borda: '#808080', label: '2º' },
  3: { cor: '#CD7F32', fundo: '#1e1000', borda: '#8B5513', label: '3º' },
};

function CartaoPodio({ item, posicao }) {
  const cfg = PODIO_CONFIG[posicao];
  const eh1 = posicao === 1;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      maxWidth: 180,
    }}>
      {eh1 && (
        <div style={{ fontSize: 28, marginBottom: 4 }}>👑</div>
      )}

      <div style={{
        width: eh1 ? 72 : 60,
        height: eh1 ? 72 : 60,
        borderRadius: '50%',
        background: cfg.fundo,
        border: `3px solid ${cfg.cor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        fontSize: eh1 ? 24 : 20,
        color: cfg.cor,
        marginBottom: 8,
        boxShadow: `0 0 12px ${cfg.cor}55`,
      }}>
        {iniciais(item.motorista)}
      </div>

      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        fontSize: eh1 ? 14 : 13,
        color: 'var(--texto)',
        textAlign: 'center',
        marginBottom: 4,
        maxWidth: 160,
        wordBreak: 'break-word',
      }}>
        {item.motorista}
      </div>

      <div style={{
        fontFamily: 'Barlow, sans-serif',
        fontSize: 12,
        color: 'var(--texto-suave)',
        textAlign: 'center',
        marginBottom: 2,
      }}>
        {item.total_devolucoes} {item.total_devolucoes === 1 ? 'devolução' : 'devoluções'}
      </div>

      <div style={{
        fontFamily: 'Barlow, sans-serif',
        fontSize: 11,
        color: 'var(--texto-suave)',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        {formatarValor(item.valor_total)}
      </div>

      <div style={{
        width: '100%',
        height: eh1 ? 64 : 44,
        background: cfg.fundo,
        border: `2px solid ${cfg.borda}`,
        borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: eh1 ? 28 : 22,
        color: cfg.cor,
      }}>
        {cfg.label}
      </div>
    </div>
  );
}

export default function Ranking() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState('semana');
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    fetch(`${API}/ranking?periodo=${periodo}`)
      .then(r => r.json())
      .then(d => {
        setDados(Array.isArray(d) ? d : []);
        setCarregando(false);
      })
      .catch(() => {
        setDados([]);
        setCarregando(false);
      });
  }, [periodo]);

  const top3 = dados.slice(0, 3);
  const demais = dados.slice(3);
  const maxDevolucoes = dados.length > 0 ? dados[dados.length - 1].total_devolucoes : 1;

  // Stats
  const totalMotoristas = dados.length;
  const totalDevolucoes = dados.reduce((acc, d) => acc + d.total_devolucoes, 0);
  const lider = dados.length > 0 ? dados[0].motorista : '—';

  // Pódio: 2º | 1º | 3º
  const podiumOrdem = [];
  if (top3[1]) podiumOrdem.push({ item: top3[1], pos: 2 });
  if (top3[0]) podiumOrdem.push({ item: top3[0], pos: 1 });
  if (top3[2]) podiumOrdem.push({ item: top3[2], pos: 3 });

  const ABAS = [
    { key: 'semana', label: 'SEMANA' },
    { key: 'mes',    label: 'MÊS' },
    { key: 'ano',    label: 'ANO' },
  ];

  return (
    <div className="page">
      <div className="container">

        {/* HEADER */}
        <div className="tela-header" style={{ marginBottom: 0 }}>
          <button className="btn-voltar" onClick={() => navigate('/')}>
            &#8592; Voltar
          </button>
          <span className="tela-header-titulo">RANKING DE MOTORISTAS</span>
          <span style={{ fontSize: 24 }}>🏆</span>
        </div>

        {/* ABAS */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid var(--borda)',
          marginBottom: 20,
        }}>
          {ABAS.map(aba => (
            <button
              key={aba.key}
              onClick={() => setPeriodo(aba.key)}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'none',
                border: 'none',
                borderBottom: periodo === aba.key ? '3px solid var(--vermelho)' : '3px solid transparent',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: 1,
                color: periodo === aba.key ? 'var(--texto)' : 'var(--texto-suave)',
                cursor: 'pointer',
                transition: 'all 150ms',
                marginBottom: -2,
              }}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="loading-texto">Carregando...</p>
        ) : dados.length === 0 ? (
          <div className="estado-vazio">
            <div className="estado-vazio-titulo">Nenhuma devolução registrada neste período</div>
          </div>
        ) : (
          <>
            {/* BARRA DE STATS */}
            <div style={{
              display: 'flex',
              background: 'var(--fundo-card)',
              border: '1px solid var(--borda)',
              borderRadius: 10,
              marginBottom: 24,
              overflow: 'hidden',
            }}>
              {[
                { label: 'MOTORISTAS', valor: totalMotoristas },
                { label: 'DEVOLUÇÕES', valor: totalDevolucoes },
                { label: 'LÍDER', valor: lider.split(' ')[0], sub: lider.split(' ').slice(1).join(' ') },
              ].map((stat, i) => (
                <div key={i} style={{
                  flex: 1,
                  padding: '14px 8px',
                  textAlign: 'center',
                  borderRight: i < 2 ? '1px solid var(--borda)' : 'none',
                }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 800,
                    fontSize: i === 2 ? 18 : 26,
                    color: 'var(--vermelho)',
                    lineHeight: 1.1,
                  }}>
                    {stat.valor}
                  </div>
                  {stat.sub && (
                    <div style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontSize: 11,
                      color: 'var(--vermelho)',
                      opacity: 0.8,
                    }}>
                      {stat.sub}
                    </div>
                  )}
                  <div style={{
                    fontFamily: 'Barlow, sans-serif',
                    fontSize: 10,
                    color: 'var(--texto-suave)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginTop: 2,
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* PÓDIO */}
            {podiumOrdem.length > 0 && (
              <div style={{
                background: 'var(--fundo-card)',
                border: '1px solid var(--borda)',
                borderRadius: 10,
                padding: '24px 12px 0',
                marginBottom: 24,
              }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--texto-suave)',
                  textAlign: 'center',
                  letterSpacing: 2,
                  marginBottom: 20,
                  textTransform: 'uppercase',
                }}>
                  Pódio
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  gap: 8,
                }}>
                  {podiumOrdem.map(({ item, pos }) => (
                    <CartaoPodio key={pos} item={item} posicao={pos} />
                  ))}
                </div>
              </div>
            )}

            {/* LISTA DOS DEMAIS */}
            {demais.length > 0 && (
              <div style={{
                background: 'var(--fundo-card)',
                border: '1px solid var(--borda)',
                borderRadius: 10,
                overflow: 'hidden',
                marginBottom: 24,
              }}>
                {demais.map((item, idx) => (
                  <div key={item.motorista} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx < demais.length - 1 ? '1px solid var(--borda)' : 'none',
                  }}>
                    {/* Posição */}
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: 'var(--texto-suave)',
                      width: 28,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}>
                      {item.posicao}º
                    </div>

                    {/* Círculo iniciais */}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#2a2a2a',
                      border: '2px solid var(--borda)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'var(--texto-suave)',
                      flexShrink: 0,
                    }}>
                      {iniciais(item.motorista)}
                    </div>

                    {/* Nome + barra */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--texto)',
                        marginBottom: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.motorista}
                      </div>
                      <div style={{
                        height: 6,
                        background: 'var(--borda)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.round((item.total_devolucoes / maxDevolucoes) * 100)}%`,
                          background: 'var(--vermelho)',
                          borderRadius: 3,
                          transition: 'width 400ms ease',
                        }} />
                      </div>
                    </div>

                    {/* Números */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--texto)',
                      }}>
                        {item.total_devolucoes}
                      </div>
                      <div style={{
                        fontFamily: 'Barlow, sans-serif',
                        fontSize: 11,
                        color: 'var(--texto-suave)',
                      }}>
                        {formatarValor(item.valor_total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
