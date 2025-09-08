import React, {useRef} from 'react';
import {useReport} from '../context/ReportContext';
import Commandant from "./utils/Commandant";
import {NavLink} from "react-router-dom";

export default function Header() {
    const {rapport, loadRapportFile, setCenter} = useReport();
    const rapportInput = useRef<HTMLInputElement>(null);

    return (<header className="app-header">
        <div>
            <Commandant num={rapport?.joueur.numero}/>
        </div>
        <button
            className="badge"
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
            style={{
                display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid #222', flexWrap: 'wrap',
            }}
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
        </nav>
        <div className="header-spacer"/>
        <input
            ref={rapportInput}
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
        <button
            onClick={async () => {
                const txt = await fetch(`${process.env.PUBLIC_URL}/examples/rapport.xml`).then(r => r.text());
                const file = new File([txt], 'rapport.xml', {type: 'text/xml'});
                await loadRapportFile(file);
                if (rapportInput.current) rapportInput.current.value = '';
            }}
        >
            Charger exemple de rapport
        </button>
    </header>);
}
