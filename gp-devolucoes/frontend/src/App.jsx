import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ListaDatas from './components/ListaDatas.jsx';
import DevolucoesDia from './components/DevolucoesDia.jsx';
import NovaDevolucao from './components/NovaDevolucao.jsx';

function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-logo">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Grupo_Petr%C3%B3polis_logo.svg/1200px-Grupo_Petr%C3%B3polis_logo.svg.png"
            height="36"
            alt="Grupo Petropolis"
          />
          <span className="header-cd">CD ITABAIANA</span>
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
