import React from 'react';
import './App.css';
import {Route, Routes} from 'react-router-dom';
import Carte from './screens/Carte';
import ListeSystemes from './screens/ListeSystemes';
import ListeFlottes from './screens/ListeFlottes';
import ListeTechnologies from './screens/ListeTechnologies';
import {ReportProvider} from './context/ReportContext';
import ArbreTechnologies from './screens/ArbreTechnologies';
import ListePlans from './screens/ListePlans';
import CreatePlan from './screens/CreatePlan';
import RechercheTechnologique from './screens/RechercheTechnologique';
import PlayerSystemDetail from './screens/PlayerSystemDetail';
import MainLayout from "./components/MainLayout";

function App() {
    return (
        <ReportProvider>
            <Routes>
                {/* 1. TOUTES LES PAGES AVEC LE LAYOUT PRINCIPAL */}
                <Route element={<MainLayout />}>
                    <Route path="/" element={<Carte />} />
                    <Route path="/systemes" element={<ListeSystemes />} />
                    <Route path="/flottes" element={<ListeFlottes />} />
                    <Route path="/technologies" element={<ListeTechnologies />} />
                    <Route path="/arbre-technologies" element={<ArbreTechnologies />} />
                    <Route path="/plans" element={<ListePlans />} />
                    <Route path="/plans/creer" element={<CreatePlan />} />
                    <Route path="/recherche" element={<RechercheTechnologique />} />
                    <Route path="/player-system-detail/:key" element={<PlayerSystemDetail />} />
                </Route>

                {/* 2. PAGE HORS LAYOUT (Pas de Header, pas de styles imposés par le main) */}
                <Route path="/creer-plan-simple" element={<CreatePlan />} />
            </Routes>
        </ReportProvider>
    );
}

export default App;
