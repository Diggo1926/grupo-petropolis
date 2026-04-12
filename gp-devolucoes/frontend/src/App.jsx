import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ListaMeses from './components/ListaMeses.jsx';
import ListaDias from './components/ListaDias.jsx';
import DevolucoesDia from './components/DevolucoesDia.jsx';
import NovaDevolucao from './components/NovaDevolucao.jsx';

function Header({ dark, onToggleDark }) {
  const [logoErro, setLogoErro] = useState(false);

  return (
    <header className="header">
      <div className="header-inner">
        {logoErro ? (
          <div className="header-logo-fallback">GP</div>
        ) : (
          <img
            src="/logo_gp.jpg"
            height="40"
            alt="Grupo Petrópolis"
            className="header-logo-img"
            onError={() => setLogoErro(true)}
          />
        )}
        <div className="header-info">
          <span className="header-titulo">GP DEVOLUÇÕES</span>
          <span className="header-sub">CD ITABAIANA</span>
        </div>
        <label className="theme-switch" htmlFor="theme-toggle" title="Alternar tema">
          <input
            type="checkbox"
            id="theme-toggle"
            checked={dark}
            onChange={onToggleDark}
          />
          <span className="theme-slider" />
        </label>
      </div>
    </header>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const salvo = localStorage.getItem('gp-theme');
    return salvo ? salvo === 'dark' : false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('gp-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <>
      <Header dark={dark} onToggleDark={() => setDark(d => !d)} />
      <Routes>
        <Route path="/" element={<ListaMeses />} />
        <Route path="/mes/:mes" element={<ListaDias />} />
        <Route path="/dia/:data" element={<DevolucoesDia />} />
        <Route path="/nova" element={<NovaDevolucao />} />
      </Routes>
    </>
  );
}
