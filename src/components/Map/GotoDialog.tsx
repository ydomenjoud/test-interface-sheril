import React, {useState} from 'react';
import Modal from '../utils/Modal';
import {BOUNDS} from '../../utils/position';
import {XY} from '../../types';

type Props = {
    onGo: (pos: XY) => void;
    onClose: () => void;
};

// Accepte "52-4", "52_4", "52 4" ou le format complet des rapports "0_52_4" (les deux derniers nombres)
export function parseCoordinates(text: string): XY | undefined {
    const nums = text.match(/\d+/g);
    if (!nums || nums.length < 2) return undefined;
    const x = Number(nums[nums.length - 2]);
    const y = Number(nums[nums.length - 1]);
    if (x < 1 || x > BOUNDS.maxX || y < 1 || y > BOUNDS.maxY) return undefined;
    return {x, y};
}

export default function GotoDialog({onGo, onClose}: Props) {
    const [text, setText] = useState('');
    const [error, setError] = useState<string | undefined>(undefined);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const pos = parseCoordinates(text);
        if (!pos) {
            setError(`Coordonnées invalides : attendu x-y, entre 1 et ${BOUNDS.maxX}`);
            return;
        }
        onGo(pos);
        onClose();
    };

    return (
        <Modal title="Aller à une case" onClose={onClose} panelStyle={{width: 300}}>
            <form onSubmit={submit} style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <input
                    type="text"
                    autoFocus
                    value={text}
                    placeholder="x-y, ex. 30-30"
                    onChange={(e) => { setText(e.target.value); setError(undefined); }}
                    style={{background: '#333', color: '#eee', border: '1px solid #555', padding: '4px 6px', borderRadius: 4}}
                />
                {error && <div style={{color: '#f88', fontSize: '0.85em'}}>{error}</div>}
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                    <button type="button" onClick={onClose}>Annuler</button>
                    <button type="submit" style={{fontWeight: 'bold'}}>Aller</button>
                </div>
            </form>
        </Modal>
    );
}
