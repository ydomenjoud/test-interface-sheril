import {SystemeDetecte} from '../types';
import {parsePosString} from '../utils/position';

export type ManualParseResult = {
  systems: SystemeDetecte[];
  errors: { line: number; message: string }[];
};

// Parse lines like:
// nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1
export function parseManualDetectedSystems(text: string): ManualParseResult {
  const systems: SystemeDetecte[] = [];
  const errors: { line: number; message: string }[] = [];

  if (!text || !text.trim()) return { systems, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const lineNum = idx + 1;
    const line = raw.trim();
    if (!line) return; // skip empty
    try {
      const parts = line.split(';').map(s => s.trim()).filter(Boolean);
      const map: Record<string, string> = {};
      parts.forEach(p => {
        const [kRaw, ...rest] = p.split('=');
        const k = (kRaw || '').trim().toLowerCase();
        const v = rest.join('=').trim();
        if (k) map[k] = v;
      });

      const posStr = map['pos'];
      if (!posStr) throw new Error('pos manquant');
      const pos = parsePosString(posStr);

      const nom = map['nom'] || 'Système';
      const nbPla = safeInt(map['nbpla'] ?? map['nbpl'] ?? '0');
      const typeEtoile = safeInt(map['typeetoile'] ?? map['etoile'] ?? map['type'] ?? '0');

      const ownersStr = map['proprios'] ?? map['proprietaires'] ?? map['proprio'] ?? '';
      const proprietaires = ownersStr
        ? ownersStr.split(',').map(s => safeInt(s.trim())).filter(n => !Number.isNaN(n))
        : [];

      systems.push({
        type: 'detecte',
        nom,
        pos,
        typeEtoile,
        nbPla,
        proprietaires: proprietaires.sort((a, b) => a - b),
      });
    } catch (e: any) {
      errors.push({ line: lineNum, message: e?.message || 'Ligne invalide' });
    }
  });

  return { systems, errors };
}

function safeInt(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
