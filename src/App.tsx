import React from 'react';
import './App.css';
import { NavLink, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Carte from './screens/Carte';
import ListeSystemes from './screens/ListeSystemes';
import ListeFlottes from './screens/ListeFlottes';
import ListeTechnologies from './screens/ListeTechnologies';
import { ReportProvider } from './context/ReportContext';

function App() {
  return (
    <ReportProvider>
      <div className="app-root">
        <Header />
        <div className="app-body">
          <nav className="app-nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              Carte
            </NavLink>
            <NavLink to="/systemes" className={({ isActive }) => (isActive ? 'active' : '')}>
              Systèmes
            </NavLink>
            <NavLink to="/flottes" className={({ isActive }) => (isActive ? 'active' : '')}>
              Flottes
            </NavLink>
            <NavLink to="/technologies" className={({ isActive }) => (isActive ? 'active' : '')}>
              Technologies
            </NavLink>
          </nav>
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Carte />} />
              <Route path="/systemes" element={<ListeSystemes />} />
              <Route path="/flottes" element={<ListeFlottes />} />
              <Route path="/technologies" element={<ListeTechnologies />} />
            </Routes>
          </main>
        </div>
      </div>
    </ReportProvider>
  );
}

export default App;
