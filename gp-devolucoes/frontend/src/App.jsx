import { Routes, Route } from 'react-router-dom';
import ListaDatas from './components/ListaDatas.jsx';
import DevolucoesDia from './components/DevolucoesDia.jsx';
import NovaDevolucao from './components/NovaDevolucao.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ListaDatas />} />
      <Route path="/dia/:data" element={<DevolucoesDia />} />
      <Route path="/nova" element={<NovaDevolucao />} />
      <Route path="/nova/:data" element={<NovaDevolucao />} />
    </Routes>
  );
}
