import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useReport } from '../context/ReportContext';
import CombatHeatmap from '../components/CombatHeatmap';
import TacticalGrid from '../components/TacticalGrid';
import CombatTable from '../components/CombatTable'; 
import { CombatTableRow } from '../parsers/parseCombatLog'; 

export default function CombatDashboard() {
    const { logId } = useParams<{ logId: string }>(); 
    const { combatLogs } = useReport();
    const [currentTurn, setCurrentTurn] = useState(0);
    // New state to track the active combat encounter tab
    const [activeCombatTab, setActiveCombatTab] = useState<string | null>(null);

    const log = combatLogs.find(l => l.id === logId);

    // 1. Group the data by Combat Encounter
    const combats = useMemo(() => {
        if (!log || !(log as any).tableData) return {};
        const data = (log as any).tableData as CombatTableRow[];
        const groups: Record<string, CombatTableRow[]> = {};
        
        data.forEach(row => {
            if (!groups[row.combat]) groups[row.combat] = [];
            groups[row.combat].push(row);
        });
        return groups;
    }, [log]);

    const combatNames = Object.keys(combats);

    // Auto-select first tab
    useEffect(() => {
        if (combatNames.length > 0 && !activeCombatTab) {
            setActiveCombatTab(combatNames[0]);
        }
        setCurrentTurn(0);
    }, [logId, combatNames, activeCombatTab]);

    // 2. Filter Table Data by BOTH Active Tab and Current Turn
    const tableData = useMemo(() => {
        if (!activeCombatTab || !combats[activeCombatTab]) return [];
        const data = combats[activeCombatTab];
        return currentTurn === 0 ? data : data.filter(d => d.turn === currentTurn);
    }, [combats, activeCombatTab, currentTurn]);

    // 3. Battle Summary scoped to the Active Tab
    const battleSummary = useMemo(() => {
        if (!log || !activeCombatTab || !combats[activeCombatTab]) return null;

        const fleetStats: Record<string, { 
            dealt: number; 
            kills: number; 
            initialShips: Map<string, Set<string>>;
            deadShips: Set<string>;
            // New: Track performance per ship type
            typePerformance: Record<string, { damage: number; kills: number }>;
        }> = {};

        // Parse commandants from the specific tab header
        const fleetMatches = activeCombatTab.match(/F\d+_(\d+)\s+VS\s+F\d+_(\d+)/);
        const cmdIds = fleetMatches ? [`C${fleetMatches[1]}`, `C${fleetMatches[2]}`] : [];

        cmdIds.forEach(id => {
            fleetStats[id] = { 
                dealt: 0, 
                kills: 0, 
                initialShips: new Map(), 
                deadShips: new Set(),
                typePerformance: {} // Added this line
            };
        });

        // Use the grouped table data to build summary stats for THIS encounter
        combats[activeCombatTab].forEach(row => {
    const cmd = row.commandant;
    
    // 1. Ensure the fleet object and the typePerformance object exist
    if (!fleetStats[cmd]) {
        fleetStats[cmd] = { 
            dealt: 0, 
            kills: 0, 
            initialShips: new Map(), 
            deadShips: new Set(),
            typePerformance: {} // Initialize new tracking object
        };
    }

    // 2. Track initial ship counts (for the "X / Y" status display)
    if (!fleetStats[cmd].initialShips.has(row.shipType)) {
        fleetStats[cmd].initialShips.set(row.shipType, new Set());
    }
    fleetStats[cmd].initialShips.get(row.shipType)?.add(row.shipId);

    // 3. Initialize performance tracking for this specific ship type
    if (!fleetStats[cmd].typePerformance[row.shipType]) {
        fleetStats[cmd].typePerformance[row.shipType] = { damage: 0, kills: 0 };
    }

    // 4. Record Damage
    fleetStats[cmd].dealt += row.shotDamage;
    fleetStats[cmd].typePerformance[row.shipType].damage += row.shotDamage;

    // 5. Handle Kills (The Graveyard Logic)
    if (row.shotKill === 1) {
        // Increment attacker stats
        fleetStats[cmd].kills += 1;
        fleetStats[cmd].typePerformance[row.shipType].kills += 1;

        // Identify and record the victim in the OTHER fleet's deadShips set
        const victimCmd = cmdIds.find(id => id !== cmd);
        if (victimCmd && fleetStats[victimCmd]) {
            // We store the target's type and position as a unique ID for the graveyard
            // This allows us to count how many of 'ShipTypeX' were destroyed
            const victimId = `${row.targetType}_${row.targetX}_${row.targetY}_${row.targetZ}`;
            fleetStats[victimCmd].deadShips.add(victimId);
        }
    }
});

        return { fleetStats, commandants: Object.keys(fleetStats) };
    }, [log, activeCombatTab, combats]);

    if (!log || !battleSummary) {
        return <div style={{ color: 'white', padding: 40 }}>Log not found or processing...</div>;
    }

    const isGlobalView = currentTurn === 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#e0e0e0' }}>
            <header style={{ padding: '15px 25px', background: '#111', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#8bff8b' }}>{log.battleName}</h2>
                        <div style={{ marginTop: '5px', fontSize: '0.8rem', color: '#666' }}>Combat Log Analysis Engine</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isGlobalView ? '#4fc3f7' : '#8bff8b' }}>
                            {isGlobalView ? "📊 ENCOUNTER SUMMARY" : `🎯 TURN ${currentTurn}`}
                        </span>
                    </div>
                </div>

                {/* TABS NAVIGATION */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '15px', borderBottom: '1px solid #222' }}>
                    {combatNames.map(name => (
                        <button
                            key={name}
                            onClick={() => { setActiveCombatTab(name); setCurrentTurn(0); }}
                            style={{
                                padding: '8px 16px', cursor: 'pointer', border: 'none', fontSize: '0.75rem',
                                background: activeCombatTab === name ? '#222' : 'transparent',
                                color: activeCombatTab === name ? '#8bff8b' : '#666',
                                borderBottom: activeCombatTab === name ? '2px solid #8bff8b' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '15px' }}>
                    <input 
                        type="range" min="0" max={log.turns.length} value={currentTurn} 
                        onChange={(e) => setCurrentTurn(parseInt(e.target.value, 10))}
                        style={{ flex: 1, accentColor: '#8bff8b', cursor: 'pointer' }}
                    />
                    <span style={{ minWidth: '60px', textAlign: 'right', fontSize: '0.9rem', color: '#666' }}>
                        {currentTurn} / {log.turns.length}
                    </span>
                </div>
            </header>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <section style={{ flex: 1, padding: '20px', overflowY: 'auto', borderRight: isGlobalView ? 'none' : '1px solid #222' }}>
                    
                    {/* SCOPED SUMMARY CARDS */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                        {battleSummary.commandants.map((cmd, idx) => {
                            const stats = battleSummary.fleetStats[cmd];
                            return (
                                <div key={cmd} style={{ 
                                    flex: 1, padding: '15px', borderRadius: '8px',
                                    background: idx === 0 ? 'rgba(79, 195, 247, 0.05)' : 'rgba(255, 82, 82, 0.05)',
                                    borderLeft: `4px solid ${idx === 0 ? '#4fc3f7' : '#ff5252'}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <h4 style={{ margin: 0, color: idx === 0 ? '#4fc3f7' : '#ff5252', fontSize: '0.9rem' }}>CMD {cmd}</h4>
                                        <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>
                                            <div style={{ color: '#8bff8b' }}>Dealt: <strong>{stats.dealt.toLocaleString()}</strong></div>
                                            <div style={{ color: '#ff5252' }}>Kills: <strong>{stats.kills}</strong></div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {Array.from(stats.initialShips.entries()).map(([type, ids]) => {
                                            const total = ids.size;
                                            const deadCount = Array.from(stats.deadShips).filter(d => d.startsWith(type + "_")).length;
                                            return (
                                                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa' }}>
                                                    <span>{type}</span>
                                                    <span style={{ color: total - deadCount === 0 ? '#ff5252' : '#eee' }}>{total - deadCount} / {total}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '25px' }}>
                        {battleSummary.commandants.map((cmd, idx) => {
                            const stats = battleSummary.fleetStats[cmd];
                            return (
                                <div key={`perf-${cmd}`} style={{ flex: 1, background: '#0d0d0d', border: '1px solid #222', borderRadius: '8px', padding: '15px' }}>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                        Type Performance & Losses
                                    </h5>
                                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ color: '#444', textAlign: 'left' }}>
                                                <th style={{ paddingBottom: '5px' }}>Ship Type</th>
                                                <th style={{ textAlign: 'center' }}>Damage</th>
                                                <th style={{ textAlign: 'center' }}>Kills</th>
                                                <th style={{ textAlign: 'right' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.keys(stats.typePerformance).map(type => {
                                                const perf = stats.typePerformance[type];
                                                const deadCount = Array.from(stats.deadShips).filter(d => d.startsWith(type  + "_")).length;
                                                return (
                                                    <tr key={type} style={{ borderTop: '1px solid #1a1a1a' }}>
                                                        <td style={{ padding: '6px 0', color: '#eee' }}>{type}</td>
                                                        <td style={{ textAlign: 'center', color: '#8bff8b' }}>{perf.damage.toLocaleString()}</td>
                                                        <td style={{ textAlign: 'center', color: perf.kills > 0 ? '#ff5252' : '#444' }}>{perf.kills}</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {deadCount > 0 ? (
                                                                <span style={{ color: '#ff5252', background: 'rgba(255,82,82,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                                    -{deadCount} LOST
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#444' }}>INTACT</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ marginBottom: '30px' }}>
                        <CombatTable data={tableData} />
                    </div>

                    <div style={{ borderTop: '1px solid #222', paddingTop: '30px' }}>
                        {/* Pass the scoped tableData, the active tab name, and the turn filter */}
                        <CombatHeatmap 
                            data={tableData} 
                            activeTab={activeCombatTab || ''} 
                            turnFilter={currentTurn} 
                        />
                    </div>
                </section>
                
                {!isGlobalView && (
                    <aside style={{ width: '400px', background: '#050505', display: 'flex', flexDirection: 'column', padding: '20px' }}>
                        <TacticalGrid turn={log.turns[currentTurn - 1]} />
                    </aside>
                )}
            </div>
        </div>
    );
}
