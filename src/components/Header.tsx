import React, {useRef} from 'react';
import {useReport} from '../context/ReportContext';
import Commandant from "./utils/Commandant";
import {NavLink} from "react-router-dom";

export default function Header() {
    const {rapport, loadRapportFile, setCenter, refreshStats} = useReport();
    const rapportInput = useRef<HTMLInputElement>(null);

    return (<header className="app-header">
        <div>
            <Commandant num={rapport?.joueur.numero}/>
        </div>
        <button
            className="badge hideOnMobile"
            onClick={() => {
                if (rapport?.joueur.capitale) setCenter(rapport.joueur.capitale);
            }}
            title="Centrer sur la capitale"
            style={{cursor: rapport?.joueur.capitale ? 'pointer' : 'not-allowed'}}
        >
            Capitale: {rapport?.joueur.capitale ? `${rapport.joueur.capitale.x}-${rapport.joueur.capitale.y}` : '—'}
        </button>
        <nav
            className="app-nav"
        >
            <NavLink to="/" end className={({isActive}) => (isActive ? 'active' : '')}>
                Carte
            </NavLink>
            <NavLink to="/systemes" className={({isActive}) => (isActive ? 'active' : '')}>
                Systèmes
            </NavLink>
            <NavLink to="/flottes" className={({isActive}) => (isActive ? 'active' : '')}>
                Flottes
            </NavLink>
            <NavLink to="/technologies" className={({isActive}) => (isActive ? 'active' : '')}>
                Technologies
            </NavLink>
            <NavLink to="/arbre-technologies" className={({isActive}) => (isActive ? 'active' : '')}>
                Arbre techno
            </NavLink>
            <NavLink to="/plans" className={({isActive}) => (isActive ? 'active' : '')}>
                Plans
            </NavLink>
            <NavLink to="/planification" className={({isActive}) => (isActive ? 'active' : '')}>
                Planification
            </NavLink>
            <NavLink to="/recherche" className={({isActive}) => (isActive ? 'active' : '')}>
                Recherche
            </NavLink>
        </nav>
        <div className="header-spacer"/>
        <button
            className="badge hideOnMobile"
            onClick={async () => {
                await refreshStats();
            }}
            title="Rafraîchir les données publiques (races, combats)"
            style={{marginRight: 8}}
        >
            Rafraichir stats
        </button>
        <label className="file-label">
            <svg
                className="file-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                        >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            <input
                ref={rapportInput}
                className="file-input"
                type="file"
                accept=".xml"
                onChange={async (e) => {
                    const f = e.currentTarget?.files?.[0];
                    // On capture la ref AVANT l'await pour éviter tout souci avec l'event
                    const inputEl = rapportInput.current;
                    if (f) {
                        await loadRapportFile(f);
                    }
                    if (inputEl) inputEl.value = '';
                }}
                title="Charger rapport.xml"
            />
        </label>
    </header>
);
}
