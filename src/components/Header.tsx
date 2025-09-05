import React from 'react';
import { Commandant } from '../models/types';
import './Header.css';

interface HeaderProps {
  commandant: Commandant;
}

const Header: React.FC<HeaderProps> = ({ commandant }) => {
  return (
    <header className="App-header">
      <div>
        <span>Nom: {commandant.nom}</span>
        <span>Race: {commandant.race}</span>
        <span>Réputation: {commandant.reputation}</span>
        <span>Statut: {commandant.statut}</span>
        <span>Puissance: {commandant.puissance}</span>
      </div>
      <nav>
        {/* Navigation links can be added here */}
      </nav>
    </header>
  );
};

export default Header;
