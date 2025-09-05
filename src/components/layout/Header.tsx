import React from 'react';
import { useAppStore } from '../../store';
import { Link } from 'react-router-dom';
import { parseRapport } from '../../services/xmlParser';

const Header: React.FC = () => {
    const { rapport, setRapport } = useAppStore();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                if (content) {
                    const parsedRapport = parseRapport(content);
                    setRapport(parsedRapport);
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <header className="header">
            <div className="player-info">
                {rapport ? (
                    <>
                        <span>Nom: {rapport.player.nom}</span>
                        <span>Race: {rapport.player.race}</span>
                        <span>Réputation: {rapport.player.reputation}</span>
                        <span>Statut: {rapport.player.statut}</span>
                        <span>Puissance: {rapport.player.puissance}</span>
                        <span>Argent: {rapport.player.argent}</span>
                        <span>Capitale: {rapport.player.capitale}</span>
                    </>
                ) : (
                    <span>Aucun rapport chargé</span>
                )}
            </div>
            <div className="file-loader">
                <input type="file" onChange={handleFileChange} accept=".xml" />
            </div>
            <nav className="navigation">
                <Link to="/carte">Carte</Link>
                <Link to="/technologies">Technologies</Link>
                <Link to="/systemes">Systèmes</Link>
                <Link to="/flottes">Flottes</Link>
            </nav>
        </header>
    );
};

export default Header;
