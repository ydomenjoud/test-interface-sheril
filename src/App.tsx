import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { useAppStore } from './store';
import { parseGlobalData } from './services/xmlParser';
import TechnologiesScreen from './screens/TechnologiesScreen';
import SystemsScreen from './screens/SystemsScreen';
import FleetsScreen from './screens/FleetsScreen';
import MapScreen from './screens/MapScreen';
import './App.css';

const App: React.FC = () => {
    const { setGlobalData, rapport } = useAppStore();

    useEffect(() => {
        const loadGlobalData = async () => {
            try {
                const response = await fetch('/examples/data.xml');
                const xmlText = await response.text();
                const parsedData = parseGlobalData(xmlText);
                setGlobalData(parsedData);
            } catch (error) {
                console.error("Failed to load global data", error);
            }
        };

        loadGlobalData();
    }, [setGlobalData]);

    return (
        <Router>
            <Layout>
                {rapport ? (
                    <Routes>
                        <Route path="/carte" element={<MapScreen />} />
                        <Route path="/technologies" element={<TechnologiesScreen />} />
                        <Route path="/systemes" element={<SystemsScreen />} />
                        <Route path="/flottes" element={<FleetsScreen />} />
                        <Route path="/" element={<MapScreen />} />
                    </Routes>
                ) : (
                    <div className="centered-message">
                        <h1>Veuillez charger un rapport</h1>
                    </div>
                )}
            </Layout>
        </Router>
    );
};

export default App;
