import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Technology } from '../models';
import './TechnologiesScreen.css';

const TechnologiesScreen: React.FC = () => {
    const { globalData, rapport } = useAppStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');

    const technologies = globalData?.technologies || [];

    const filteredTechnologies = useMemo(() => {
        return technologies
            .filter(tech => {
                // Assumption: 'known' and 'researchable' status would be derived from the player's report.
                // Since the report data structure for technologies is not specified,
                // we will consider all as 'unknown' if no report is loaded,
                // and 'researchable' if a report is loaded.
                if (filter === 'known') {
                    // TODO: Implement logic to check if technology is known by the player
                    return false;
                }
                if (filter === 'researchable') {
                    return !!rapport;
                }
                if (filter === 'unknown') {
                    return !rapport;
                }
                return true;
            })
            .filter(tech =>
                tech.nom.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [technologies, searchTerm, filter, rapport]);

    return (
        <div className="technologies-screen">
            <h1>Technologies</h1>
            <div className="filters">
                <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="all">Toutes</option>
                    <option value="known">Connues</option>
                    <option value="researchable">Recherchables</option>
                    <option value="unknown">Inconnues</option>
                </select>
            </div>
            <table className="technologies-table">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Niveau</th>
                        <th>Description</th>
                        <th>Coût</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTechnologies.map(tech => (
                        <tr key={tech.code}>
                            <td>{tech.nom}</td>
                            <td>{tech.niv}</td>
                            <td>{tech.description}</td>
                            <td>{tech.recherche}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TechnologiesScreen;
