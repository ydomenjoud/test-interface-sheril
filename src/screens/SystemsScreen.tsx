import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { System } from '../models';
import './SystemsScreen.css';

const SystemsScreen: React.FC = () => {
    const { rapport } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');

    const systems = rapport?.player.systems || [];

    const filteredSystems = useMemo(() => {
        return systems.filter(system =>
            system.nom.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [systems, searchTerm]);

    return (
        <div className="systems-screen">
            <h1>Systèmes</h1>
            <div className="filters">
                <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <table className="systems-table">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Position</th>
                        <th>Nombre de planètes</th>
                        <th>Commandants</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredSystems.map(system => (
                        <tr key={system.pos}>
                            <td>{system.nom}</td>
                            <td>{system.pos}</td>
                            <td>{system.nombrePla}</td>
                            <td>{system.proprio.join(', ')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SystemsScreen;
