import React, {useRef} from 'react';
import {useReport} from '../context/ReportContext';
import Commandant from "./utils/Commandant";
import { NavLink, useNavigate, useLocation } from "react-router-dom";

export default function Header() {
    const { rapport, loadRapportFile, setCenter, loadCombatLog, combatLogs } = useReport();
    const rapportInput = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Determine the current log ID from the URL to keep the selector in sync
    const currentLogId = location.pathname.startsWith('/combat/')
        ? location.pathname.split('/')[2]
        : "";

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
        <nav className="app-nav" style={{ display: 'flex', gap: 12, padding: '8px 12px', flexWrap: 'wrap' }}>
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
            <NavLink to="/recherche" className={({isActive}) => (isActive ? 'active' : '')}>
                Recherche
            </NavLink>
        </nav>
        <div className="header-spacer"/>

        {combatLogs.length > 0 && (
            <select
                className="combat-selector"
                value={currentLogId}
                onChange={(e) => e.target.value && navigate(`/combat/${e.target.value}`)}
                style={{ marginRight: '10px', background: '#222', color: '#8bff8b', border: '1px solid #444', borderRadius: '4px' }}
            >
                <option value="" disabled>Select Battle...</option>
                {combatLogs.map(log => (
                    <option key={log.id} value={log.id}>{log.battleName}</option>
                ))}
            </select>
        )}

        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="badge" onClick={() => rapportInput.current?.click()}>📁 XML</button>
        <input
            ref={rapportInput}
            type="file"
            accept=".xml"
                style={{ display: 'none' }}
            onChange={async (e) => {
                const f = e.currentTarget?.files?.[0];
                    if (f) await loadRapportFile(f);
                    e.currentTarget.value = '';
            }}
        />

            <label className="badge combat-upload" style={{ cursor: 'pointer', background: '#2c3e50' }}>
                ⚔️ Log
                <input
                    type="file"
                    accept=".log"
                    onChange={(e) => e.target.files?.[0] && loadCombatLog(e.target.files[0])}
                    style={{ display: 'none' }}
                />
            </label>
        </div>
    </header>);
}
