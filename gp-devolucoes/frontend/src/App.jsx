import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import ListaDatas from './components/ListaDatas.jsx';
import DevolucoesDia from './components/DevolucoesDia.jsx';
import NovaDevolucao from './components/NovaDevolucao.jsx';

function Header() {
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
      </div>
    </header>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<ListaDatas />} />
        <Route path="/dia/:data" element={<DevolucoesDia />} />
        <Route path="/nova" element={<NovaDevolucao />} />
      </Routes>
    </>
  );
}
