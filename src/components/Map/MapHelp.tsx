import React, {useEffect, useState} from 'react';
import {isTypingTarget} from '../../utils/keyboard';
import Modal from '../utils/Modal';

type Shortcut = { keys: string[][]; description: string };

// Chaque entrée de `keys` est une alternative ; chaque alternative est une combinaison de touches
const SECTIONS: { title: string; items: Shortcut[] }[] = [
    {
        title: 'Navigation',
        items: [
            {keys: [['Glisser']], description: 'Déplacer la carte'},
            {keys: [['← ↑ → ↓']], description: "Déplacer la carte d'une case"},
            {keys: [['Ctrl', 'Flèche']], description: 'Déplacer la carte de 5 cases'},
            {keys: [['Molette']], description: 'Zoomer / dézoomer'},
            {keys: [['Clic sur la minicarte']], description: 'Centrer la carte sur ce point'},
        ],
    },
    {
        title: 'Sélection',
        items: [
            {keys: [['Clic']], description: 'Sélectionner une case et afficher son contenu (systèmes, flottes, zones, notes) dans le panneau de droite'},
            {keys: [['Ctrl', 'Clic']], description: 'Sélectionner une case et tracer les flèches de mes flottes vers elle (vert : atteignable ce tour, orange : trop loin)'},
        ],
    },
    {
        title: 'Zones',
        items: [
            {keys: [['Alt', 'Clic', 'Glisser']], description: 'Tracer une zone de la case de départ à la case de fin, puis choisir label et couleurs'},
            {keys: [['Alt', 'Clic']], description: 'Sélectionner la case : ses zones sont modifiables dans le panneau de droite (label, déplacement, largeur, hauteur, suppression)'},
        ],
    },
    {
        title: 'Fenêtres',
        items: [
            {keys: [['?']], description: 'Afficher / masquer cette aide'},
            {keys: [['Échap']], description: 'Fermer la fenêtre ouverte'},
            {keys: [['Entrée']], description: 'Valider la saisie en cours'},
        ],
    },
];

const kbdStyle: React.CSSProperties = {
    display: 'inline-block', background: '#333', border: '1px solid #555', borderBottomWidth: 2, borderRadius: 4,
    padding: '1px 6px', fontFamily: 'inherit', fontSize: '0.85em', color: '#eee', whiteSpace: 'nowrap',
};

// Touches de modification, affichées dans une teinte différente pour les distinguer
const MODIFIER_KEYS = ['Alt', 'Ctrl', 'Maj'];
const modifierKbdStyle: React.CSSProperties = {...kbdStyle, background: '#2a3550', borderColor: '#4a6090', color: '#cfe0ff'};

export default function MapHelp() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (isTypingTarget(e.target)) return;
            if (e.key === '?') {
                setOpen(o => !o);
                e.preventDefault();
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Aide et raccourcis (?)"
                style={{
                    position: 'absolute', left: 20, bottom: 20, zIndex: 100, width: 32, height: 32, borderRadius: '50%',
                    background: '#222', color: '#eee', border: '2px solid #ffe600', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    fontWeight: 'bold', fontSize: '1.1em', cursor: 'pointer',
                }}
            >
                ?
            </button>

            {open && (
                <Modal title="Aide de la carte" showCloseButton onClose={() => setOpen(false)} panelStyle={{width: 520}}>
                    {SECTIONS.map((section, i) => (
                        <div key={section.title} style={{marginTop: i === 0 ? 0 : 14}}>
                            <div style={{fontSize: '0.8em', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6}}>{section.title}</div>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                <tbody>
                                {section.items.map(item => (
                                    <tr key={item.description}>
                                        <td style={{padding: '4px 12px 4px 0', verticalAlign: 'top', width: 1, whiteSpace: 'nowrap'}}>
                                            {item.keys.map((combo, i) => (
                                                <span key={i}>
                                                    {i > 0 && <span style={{color: '#888'}}> ou </span>}
                                                    {combo.map((k, j) => (
                                                        <span key={j}>
                                                            {j > 0 && <span style={{color: '#888'}}> + </span>}
                                                            <kbd style={MODIFIER_KEYS.includes(k) ? modifierKbdStyle : kbdStyle}>{k}</kbd>
                                                        </span>
                                                    ))}
                                                </span>
                                            ))}
                                        </td>
                                        <td style={{padding: '4px 0', fontSize: '0.9em'}}>{item.description}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </Modal>
            )}
        </>
    );
}
