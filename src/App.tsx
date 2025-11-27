import React from 'react';
import './App.css';
import {Route, Routes} from 'react-router-dom';
import Header from './components/Header';
import Carte from './screens/Carte';
import ListeSystemes from './screens/ListeSystemes';
import ListeFlottes from './screens/ListeFlottes';
import ListeTechnologies from './screens/ListeTechnologies';
import {ReportProvider} from './context/ReportContext';
import ArbreTechnologies from './screens/ArbreTechnologies';
import ListePlans from './screens/ListePlans';
import CreatePlan from './screens/CreatePlan';
import RechercheTechnologique from './screens/RechercheTechnologique';
import Terraformation from './screens/Terraformation';

function App() {
    return (<ReportProvider>
            <div className="app-root">
                <Header/>
                <div className="app-body" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>

                    <main
                        className="app-main"
                        style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}
                    >
                        <Routes>
                            <Route path="/" element={<Carte/>}/>
                            <Route path="/systemes" element={<ListeSystemes/>}/>
                            <Route path="/flottes" element={<ListeFlottes/>}/>
                            <Route path="/technologies" element={<ListeTechnologies/>}/>
                            <Route path="/arbre-technologies" element={<ArbreTechnologies/>}/>
                            <Route path="/plans" element={<ListePlans/>}/>
                            <Route path="/plans/creer" element={<CreatePlan/>}/>
                            <Route path="/recherche" element={<RechercheTechnologique/>}/>
                            <Route path="/terraformation" element={<Terraformation/>}/>
                        </Routes>
                    </main>
                </div>
            </div>
        </ReportProvider>);
}

export default App;
