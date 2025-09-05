import React, { useEffect, useState } from 'react';
import './App.css';
import { Route, Routes } from "react-router-dom";
import { loadRapportData, loadGlobalData } from './services/dataLoader';
import { Rapport, GlobalData } from './models/types';
import Header from './components/Header';
import MapScreen from './components/MapScreen';

function App() {
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const rapportData = await loadRapportData();
        const gData = await loadGlobalData();
        setRapport(rapportData);
        setGlobalData(gData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!rapport || !globalData) {
    return <div>Error loading data. Please check the console.</div>;
  }

  return (
    <div>
      <Header commandant={rapport.COMMANDANT} />
      <main>
        <Routes>
          <Route path="/" element={<MapScreen rapport={rapport} globalData={globalData} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
