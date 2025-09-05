import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Fleet } from '../models';
import './FleetsScreen.css';

const FleetsScreen: React.FC = () => {
    const { rapport } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');

    const fleets = rapport?.player.fleets || [];

    const filteredFleets = useMemo(() => {
        return fleets.filter(fleet =>
            fleet.nom.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [fleets, searchTerm]);

    return (
        <div className="fleets-screen">
            <h1>Flottes</h1>
            <div className="filters">
                <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <table className="fleets-table">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Position</th>
                        <th>Nombre de vaisseaux</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredFleets.map(fleet => (
                        <tr key={fleet.num}>
                            <td>{fleet.nom}</td>
                            <td>{fleet.pos}</td>
                            <td>{fleet.vaisseaux.length}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default FleetsScreen;
