import React, { useEffect, useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import { SystemeJoueur, XY } from '../types';
import { posToString } from '../utils/position';

// Tri des systèmes par coordonnées : x, puis y
const comparerPositions = (a: XY, b: XY) => a.x - b.x || a.y - b.y;
import { copierSchema, deserialiserSchema } from '../utils/ordreSchema';
import {
    CODE_MINERAI, InventaireSysteme, inventaireDuRapport, lireOrdreTransfert, nombreMaxTransferts, nouvelIdTransfert,
    quantite, ResultatTransfert, schemaTransferts, simulerTransferts, TransfertOrdre, typeObjet,
} from '../utils/ordreTransfert';
import { loadTransferts, saveTransferts } from '../storage/transfertsStorage';

// Écran « Transferts » : programmation des ordres charger_cargo (déplacement de bâtiments,
// marchandises et minerai entre ses systèmes). Règles du moteur : docs/transferts.md.

const CLE_COLONNES = ['transferts_colonne_gauche', 'transferts_colonne_droite'] as const;
const MIME_OBJET = 'application/x-sheril-transfert';

const lireColonne = (cle: string): string | null => {
    try { return localStorage.getItem(cle); } catch { return null; }
};
const ecrireColonne = (cle: string, valeur: string) => {
    try { localStorage.setItem(cle, valeur); } catch { /* préférence non conservée */ }
};

const COULEURS_STATUT: Record<ResultatTransfert['statut'], string> = {
    ok: '#81c784',
    partiel: '#ffb74d',
    erreur: '#e57373',
    ignore: '#888',
};
const LIBELLES_STATUT: Record<ResultatTransfert['statut'], string> = {
    ok: '✓',
    partiel: '⚠ partiel',
    erreur: '✖ erreur',
    ignore: '✖ ignoré',
};

const panneau: React.CSSProperties = {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    padding: '8px 12px',
};
const bouton: React.CSSProperties = {
    background: '#333', color: '#e0e0e0', border: '1px solid #555', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
};
const petitBouton: React.CSSProperties = { ...bouton, padding: '0 6px', fontSize: '0.9em' };
const champ: React.CSSProperties = {
    background: '#1e1e1e', color: '#e0e0e0', border: '1px solid #555', borderRadius: '4px', padding: '2px 4px',
};
const th: React.CSSProperties = { padding: '3px 8px', color: '#aaa', fontWeight: 'normal', textAlign: 'right', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '2px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
const titreGroupe: React.CSSProperties = { color: '#aaa', textTransform: 'uppercase', fontSize: '0.75em', paddingTop: '8px' };

const signe = (n: number) => (n > 0 ? `+${n}` : String(n));
const couleurDelta = (n: number) => (n > 0 ? '#81c784' : n < 0 ? '#e57373' : undefined);

interface ObjetDrag {
    colonne: number;
    code: string;
}

export default function Transferts() {
    const { rapport, global } = useReport();
    const tour = rapport?.tour;
    const numeroJoueur = rapport?.joueur.numero ?? -1;

    const systemes = useMemo(
        () => [...(rapport?.systemesJoueur ?? [])].sort((a, b) => comparerPositions(a.pos, b.pos)),
        [rapport],
    );
    const systemeParCle = useMemo(() => {
        const m: Record<string, SystemeJoueur> = {};
        systemes.forEach(s => { m[posToString(s.pos)] = s; });
        return m;
    }, [systemes]);

    // Noms des objets transportables
    const nomObjet = useMemo(() => {
        const techs: Record<string, string> = {};
        // Les niveaux d'un bâtiment portent le même nom : on ajoute le niveau (suffixe du code, ex. optpII → II)
        (global?.technologies ?? []).forEach(t => {
            const niveau = t.code.startsWith(t.base) && t.code.length > t.base.length ? t.code.slice(t.base.length) : String(t.niv + 1);
            techs[t.code] = `${t.nom} ${niveau}`;
        });
        const marchandises: Record<string, string> = {};
        (global?.marchandises ?? []).forEach(m => { marchandises[String(m.code)] = m.nom; });
        return (code: string): string => {
            const type = typeObjet(code);
            if (type === 'minerai') return 'Minerai';
            if (type === 'marchandise') return marchandises[code] ?? `Marchandise ${code}`;
            return techs[code] ?? code;
        };
    }, [global]);

    // Ordres du tour, dans l'ordre de résolution
    const [store, setStore] = useState<{ tour: number | undefined; ordres: TransfertOrdre[] }>({ tour: undefined, ordres: [] });
    useEffect(() => {
        if (tour !== undefined) setStore({ tour, ordres: loadTransferts(tour) });
    }, [tour]);
    const ordres = useMemo(() => (store.tour === tour ? store.ordres : []), [store, tour]);
    const setOrdres = (maj: (prev: TransfertOrdre[]) => TransfertOrdre[]) => {
        if (tour === undefined) return;
        setStore(prev => {
            const suivants = maj(prev.tour === tour ? prev.ordres : []);
            saveTransferts(tour, suivants);
            return { tour, ordres: suivants };
        });
    };

    // Systèmes affichés dans les deux colonnes (préférence conservée) et planète choisie (null = toutes)
    const [colonnes, setColonnes] = useState<[string | null, string | null]>(() => [lireColonne(CLE_COLONNES[0]), lireColonne(CLE_COLONNES[1])]);
    const [planetes, setPlanetes] = useState<[number | null, number | null]>([null, null]);
    const colonnesEffectives = useMemo<[string | null, string | null]>(() => {
        const cles = systemes.map(s => posToString(s.pos));
        const gauche = colonnes[0] && systemeParCle[colonnes[0]] ? colonnes[0] : cles[0] ?? null;
        const droite = colonnes[1] && systemeParCle[colonnes[1]] ? colonnes[1] : cles.find(c => c !== gauche) ?? null;
        return [gauche, droite];
    }, [colonnes, systemes, systemeParCle]);
    const choisirSysteme = (i: 0 | 1, cle: string) => {
        setColonnes(prev => (i === 0 ? [cle, prev[1]] : [prev[0], cle]));
        setPlanetes(prev => (i === 0 ? [null, prev[1]] : [prev[0], null]));
        ecrireColonne(CLE_COLONNES[i], cle);
    };
    const choisirPlanete = (i: 0 | 1, p: number | null) => setPlanetes(prev => (i === 0 ? [p, prev[1]] : [prev[0], p]));

    // Limite de transferts et simulation
    const max = useMemo(
        () => nombreMaxTransferts(systemes, numeroJoueur, rapport?.technologiesConnues ?? []),
        [systemes, numeroJoueur, rapport],
    );
    const avant = useMemo(() => inventaireDuRapport(systemes, numeroJoueur), [systemes, numeroJoueur]);
    const simulation = useMemo(() => simulerTransferts(avant, ordres, max.total), [avant, ordres, max.total]);

    // Production du tour d'un objet sur un système (ou une planète)
    const production = (cle: string, code: string, planete: number | null): number => {
        const s = systemeParCle[cle];
        if (!s) return 0;
        const type = typeObjet(code);
        if (type === 'marchandise') return s.marchandises?.find(m => String(m.code) === code)?.prod ?? 0;
        if (type === 'minerai') {
            return s.planetes
                .filter(p => (planete === null ? p.proprietaire === numeroJoueur : p.num === planete))
                .reduce((acc, p) => acc + (p.prodMinerai ?? 0), 0);
        }
        return 0;
    };

    // Objets d'un système : minerai, puis bâtiments et marchandises présents avant ou après les transferts
    const objetsDuSysteme = (cle: string): { batiments: string[]; marchandises: string[] } => {
        const codes = new Set<string>();
        [avant[cle], simulation.apres[cle]].forEach((inv?: InventaireSysteme) => {
            if (!inv) return;
            // Bâtiments des seules planètes du joueur : ceux d'un voisin dans le même système ne sont pas transférables
            inv.planetes.filter(p => p.mienne).forEach(p => Object.entries(p.batiments).forEach(([c, n]) => { if (n > 0) codes.add(c); }));
            Object.entries(inv.marchandises).forEach(([c, n]) => { if (n > 0) codes.add(c); });
        });
        if (systemeParCle[cle]?.marchandises?.some(m => m.prod > 0)) {
            systemeParCle[cle].marchandises?.forEach(m => { if (m.prod > 0) codes.add(String(m.code)); });
        }
        const tri = (a: string, b: string) => nomObjet(a).localeCompare(nomObjet(b));
        const liste = Array.from(codes);
        return {
            batiments: liste.filter(c => typeObjet(c) === 'batiment').sort(tri),
            marchandises: liste.filter(c => typeObjet(c) === 'marchandise').sort(tri),
        };
    };

    // Ajoute un transfert de la colonne i vers l'autre colonne : quantité = stock disponible après les ordres déjà saisis
    const ajouterTransfert = (i: 0 | 1, code: string) => {
        const de = colonnesEffectives[i];
        const vers = colonnesEffectives[i === 0 ? 1 : 0];
        if (!de || !vers || de === vers) return;
        const planeteDe = planetes[i];
        const dispo = quantite(simulation.apres[de], code, planeteDe);
        const sDe = systemeParCle[de];
        const sVers = systemeParCle[vers];
        setOrdres(prev => [...prev, {
            id: nouvelIdTransfert(),
            de: sDe.pos,
            vers: sVers.pos,
            code,
            nombre: Math.max(1, dispo),
            planeteDe,
            planeteVers: planetes[i === 0 ? 1 : 0],
        }]);
    };

    const modifierOrdre = (id: string, maj: Partial<TransfertOrdre>) =>
        setOrdres(prev => prev.map(o => (o.id === id ? { ...o, ...maj } : o)));
    const supprimerOrdre = (id: string) => setOrdres(prev => prev.filter(o => o.id !== id));
    const deplacerOrdre = (index: number, sens: -1 | 1) => setOrdres(prev => {
        const cible = index + sens;
        if (cible < 0 || cible >= prev.length) return prev;
        const copie = [...prev];
        [copie[index], copie[cible]] = [copie[cible], copie[index]];
        return copie;
    });
    const afficherOrdre = (o: TransfertOrdre) => {
        choisirSysteme(0, posToString(o.de));
        choisirSysteme(1, posToString(o.vers));
        setPlanetes([o.planeteDe, o.planeteVers]);
    };

    // Glisser-déposer d'un objet d'une colonne vers l'autre
    const [survol, setSurvol] = useState<number | null>(null);
    const [glisse, setGlisse] = useState<ObjetDrag | null>(null);

    // Schéma : copie et import
    const schema = useMemo(() => schemaTransferts(ordres), [ordres]);
    const [schemaCopie, setSchemaCopie] = useState(false);
    const copier = () => copierSchema(schema).then(ok => {
        if (!ok) return;
        setSchemaCopie(true);
        setTimeout(() => setSchemaCopie(false), 2000);
    });
    const [importOuvert, setImportOuvert] = useState(false);
    const [texteImport, setTexteImport] = useState('');
    const [erreurImport, setErreurImport] = useState<string | null>(null);
    const importer = () => {
        try {
            const lus = deserialiserSchema(texteImport).map(lireOrdreTransfert).filter((o): o is TransfertOrdre => !!o);
            if (lus.length === 0) {
                setErreurImport('Aucun ordre de transfert lisible dans ce schéma');
                return;
            }
            setOrdres(() => lus);
            setImportOuvert(false);
            setTexteImport('');
            setErreurImport(null);
        } catch {
            setErreurImport('Schéma illisible');
        }
    };

    if (!rapport) {
        return <div style={{ padding: 20, color: '#e0e0e0' }}>Chargez un rapport pour programmer des transferts.</div>;
    }

    const nomSysteme = (pos: XY) => {
        const s = systemeParCle[posToString(pos)];
        return s ? `${s.nom} (${pos.x}-${pos.y})` : `${pos.x}-${pos.y} (non possédé)`;
    };

    const selectSysteme = (valeur: string | null, onChange: (cle: string) => void, style?: React.CSSProperties) => (
        <select value={valeur ?? ''} onChange={e => onChange(e.target.value)} style={{ ...champ, ...style }}>
            {valeur && !systemeParCle[valeur] && <option value={valeur}>{valeur.replace('_', '-')} (non possédé)</option>}
            {systemes.map(s => (
                <option key={posToString(s.pos)} value={posToString(s.pos)}>{s.nom} ({s.pos.x}-{s.pos.y})</option>
            ))}
        </select>
    );

    const selectPlanete = (cle: string | null, valeur: number | null, onChange: (p: number | null) => void) => {
        const s = cle ? systemeParCle[cle] : undefined;
        const nb = s ? (s.nbPla || s.planetes.length) : 0;
        return (
            <select
                value={valeur === null ? '' : String(valeur)}
                onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                style={champ}
                title="Planète précise (facultatif)"
            >
                <option value="">toutes</option>
                {Array.from({ length: nb }, (_, n) => {
                    const p = s?.planetes.find(pl => pl.num === n);
                    const mienne = p?.proprietaire === numeroJoueur;
                    return <option key={n} value={n}>pl. {n + 1}{mienne ? '' : ' (pas à moi)'}</option>;
                })}
            </select>
        );
    };

    // Colonne d'un système : sélecteurs + inventaire (rapport → après transferts, production du tour)
    const colonne = (i: 0 | 1) => {
        const cle = colonnesEffectives[i];
        const autre = colonnesEffectives[i === 0 ? 1 : 0];
        const planete = planetes[i];
        const peutEnvoyer = !!cle && !!autre && cle !== autre;
        const fleche = i === 0 ? '→' : '←';
        const accepteDepot = glisse !== null && glisse.colonne !== i && peutEnvoyer;

        const ligne = (code: string) => {
            const qAvant = quantite(cle ? avant[cle] : undefined, code, planete);
            const qApres = quantite(cle ? simulation.apres[cle] : undefined, code, planete);
            const prod = cle ? production(cle, code, planete) : 0;
            const delta = qApres - qAvant;
            return (
                <tr
                    key={code}
                    draggable={peutEnvoyer}
                    onDragStart={e => {
                        e.dataTransfer.setData(MIME_OBJET, code);
                        e.dataTransfer.effectAllowed = 'copy';
                        setGlisse({ colonne: i, code });
                    }}
                    onDragEnd={() => { setGlisse(null); setSurvol(null); }}
                    style={{ cursor: peutEnvoyer ? 'grab' : 'default' }}
                    title={peutEnvoyer ? "Glisser vers l'autre colonne pour programmer un transfert" : undefined}
                >
                    <td style={{ ...td, textAlign: 'left' }}>{nomObjet(code)}</td>
                    <td style={td}>{qAvant}</td>
                    <td style={{ ...td, color: couleurDelta(delta) }}>{delta !== 0 ? signe(delta) : ''}</td>
                    <td style={{ ...td, fontWeight: 'bold', color: couleurDelta(delta) }}>{qApres}</td>
                    <td style={{ ...td, color: '#4fc3f7' }}>{prod !== 0 ? signe(prod) : ''}</td>
                    <td style={td}>
                        <button
                            type="button"
                            style={{ ...petitBouton, opacity: peutEnvoyer ? 1 : 0.3 }}
                            disabled={!peutEnvoyer}
                            onClick={() => ajouterTransfert(i, code)}
                            title={`Transférer vers l'autre colonne (quantité : stock disponible)`}
                        >
                            {fleche}
                        </button>
                    </td>
                </tr>
            );
        };

        const objets = cle ? objetsDuSysteme(cle) : { batiments: [], marchandises: [] };
        const groupe = (titre: string, codes: string[]) => (
            <>
                <tr><td colSpan={6} style={titreGroupe}>{titre}</td></tr>
                {codes.length === 0
                    ? <tr><td colSpan={6} style={{ ...td, textAlign: 'left', color: '#666' }}>aucun</td></tr>
                    : codes.map(ligne)}
            </>
        );

        return (
            <div
                style={{
                    ...panneau,
                    flex: '1 1 340px',
                    minWidth: 0,
                    overflow: 'auto',
                    outline: accepteDepot && survol === i ? '2px dashed #4fc3f7' : accepteDepot ? '1px dashed #4fc3f7' : undefined,
                }}
                onDragOver={e => {
                    if (!accepteDepot) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setSurvol(i);
                }}
                onDragLeave={() => setSurvol(null)}
                onDrop={e => {
                    e.preventDefault();
                    const code = e.dataTransfer.getData(MIME_OBJET);
                    if (glisse && glisse.colonne !== i && code) ajouterTransfert(glisse.colonne as 0 | 1, code);
                    setGlisse(null);
                    setSurvol(null);
                }}
            >
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectSysteme(cle, c => choisirSysteme(i, c), { flex: '1 1 160px', minWidth: 0 })}
                    {selectPlanete(cle, planete, p => choisirPlanete(i, p))}
                </div>
                {cle && cle === autre && (
                    <div style={{ color: '#ffb74d', fontSize: '0.85em', marginTop: '4px' }}>Choisissez deux systèmes différents.</div>
                )}
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9em', marginTop: '4px' }}>
                    <thead>
                        <tr>
                            <th style={{ ...th, textAlign: 'left' }}>Objet</th>
                            <th style={th} title="Stock du rapport">Rapport</th>
                            <th style={th} title="Effet des transferts programmés">Transf.</th>
                            <th style={th} title="Stock après les transferts">Après</th>
                            <th style={{ ...th, color: '#4fc3f7' }} title="Production du tour (résolue après les transferts)">Prod.</th>
                            <th style={th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cle && ligne(CODE_MINERAI)}
                        {groupe('Bâtiments', objets.batiments)}
                        {groupe('Marchandises', objets.marchandises)}
                    </tbody>
                </table>
            </div>
        );
    };

    // Bilan : objets touchés par les ordres, par système
    const bilan = (() => {
        const parSysteme = new Map<string, Set<string>>();
        ordres.forEach(o => {
            [o.de, o.vers].forEach(pos => {
                const cle = posToString(pos);
                if (!systemeParCle[cle]) return;
                if (!parSysteme.has(cle)) parSysteme.set(cle, new Set());
                parSysteme.get(cle)!.add(o.code);
            });
        });
        return Array.from(parSysteme.entries())
            .sort(([a], [b]) => comparerPositions(systemeParCle[a].pos, systemeParCle[b].pos))
            .map(([cle, codes]) => ({
                cle,
                lignes: Array.from(codes)
                    .sort((a, b) => (a === CODE_MINERAI ? -1 : b === CODE_MINERAI ? 1 : nomObjet(a).localeCompare(nomObjet(b))))
                    .map(code => {
                        const qAvant = quantite(avant[cle], code);
                        const qApres = quantite(simulation.apres[cle], code);
                        const prod = production(cle, code, null);
                        return { code, qAvant, delta: qApres - qAvant, qApres, prod };
                    }),
            }));
    })();

    const indexPremierIgnore = ordres.findIndex(o => simulation.resultats[o.id]?.statut === 'ignore');
    const detailMax = `Transferts possibles par tour : ${max.total}\n`
        + `• base : ${max.base}\n`
        + `• systèmes possédés à plus de 75 % : +${max.systemes75}\n`
        + `• maîtrise spatiale niveau ${max.niveauMaitrise} : +${2 * max.niveauMaitrise}\n`
        + `Les ordres au-delà sont ignorés, dans l'ordre de la liste ; un ordre en erreur ne compte pas.`;
    const depasse = ordres.some(o => simulation.resultats[o.id]?.statut === 'ignore');

    return (
        <div style={{ padding: '20px', color: '#e0e0e0', flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                <h2 style={{ color: '#fff', margin: 0, fontSize: '1.1em' }}>Transferts entre systèmes — tour {tour}</h2>
                <span
                    title={detailMax}
                    style={{ textDecoration: 'underline dotted', cursor: 'help', color: depasse ? '#e57373' : '#e0e0e0' }}
                >
                    Transferts : <strong>{simulation.utilises}</strong> / {max.total}
                </span>
                <div style={{ flex: 1 }} />
                <button type="button" style={{ ...bouton, opacity: schema ? 1 : 0.3 }} disabled={!schema} onClick={copier}
                        title="Copier le schéma des ordres de transfert à coller dans la console d'ordres">
                    {schemaCopie ? '✓ Schéma copié' : 'Copier le schéma des ordres'}
                </button>
                <button type="button" style={bouton} onClick={() => { setImportOuvert(v => !v); setErreurImport(null); }}
                        title="Remplacer les ordres du tour par ceux d'un schéma">
                    Importer un schéma
                </button>
                <button type="button" style={{ ...bouton, opacity: ordres.length ? 1 : 0.3 }} disabled={!ordres.length}
                        onClick={() => setOrdres(() => [])} title="Supprimer tous les transferts du tour">
                    ✕ Tout effacer
                </button>
            </div>

            {importOuvert && (
                <div style={{ ...panneau, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        value={texteImport}
                        onChange={e => setTexteImport(e.target.value)}
                        placeholder="transfert|…"
                        style={{ ...champ, flex: '1 1 300px', minWidth: 0 }}
                        autoFocus
                    />
                    <button type="button" style={bouton} onClick={importer} disabled={!texteImport.trim()}>Remplacer les ordres</button>
                    {erreurImport && <span style={{ color: '#e57373' }}>{erreurImport}</span>}
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {colonne(0)}
                {colonne(1)}
            </div>

            <div style={panneau}>
                <strong style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em' }}>Ordres du tour (résolus dans cet ordre)</strong>
                {ordres.length === 0 ? (
                    <div style={{ color: '#888', padding: '6px 0' }}>
                        Aucun transfert : glissez un objet d'une colonne vers l'autre, ou utilisez ses boutons → / ←.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '0.9em', marginTop: '4px' }}>
                            <thead>
                                <tr>
                                    <th style={th}>#</th>
                                    <th style={th}></th>
                                    <th style={th}>Qté</th>
                                    <th style={{ ...th, textAlign: 'left' }}>Objet</th>
                                    <th style={{ ...th, textAlign: 'left' }}>De</th>
                                    <th style={th}></th>
                                    <th style={{ ...th, textAlign: 'left' }}>Vers</th>
                                    <th style={{ ...th, textAlign: 'left' }}>Résultat</th>
                                    <th style={th}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordres.map((o, index) => {
                                    const r = simulation.resultats[o.id];
                                    return (
                                        <React.Fragment key={o.id}>
                                            {index === indexPremierIgnore && (
                                                <tr>
                                                    <td colSpan={9} style={{ ...td, textAlign: 'center', color: '#e57373', borderTop: '1px dashed #e57373', fontSize: '0.85em' }}>
                                                        limite de {max.total} transferts atteinte : les ordres suivants seront ignorés
                                                    </td>
                                                </tr>
                                            )}
                                            <tr style={{ opacity: r?.statut === 'ignore' ? 0.5 : 1 }}>
                                                <td style={td}>{index + 1}</td>
                                                <td style={td}>
                                                    <button type="button" style={petitBouton} disabled={index === 0}
                                                            onClick={() => deplacerOrdre(index, -1)} title="Monter">↑</button>
                                                    <button type="button" style={{ ...petitBouton, marginLeft: 2 }} disabled={index === ordres.length - 1}
                                                            onClick={() => deplacerOrdre(index, 1)} title="Descendre">↓</button>
                                                </td>
                                                <td style={td}>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={9999}
                                                        value={o.nombre}
                                                        onChange={e => modifierOrdre(o.id, { nombre: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value) || 0))) })}
                                                        style={{ ...champ, width: '5em', textAlign: 'right' }}
                                                    />
                                                </td>
                                                <td style={{ ...td, textAlign: 'left' }}>
                                                    <span
                                                        onClick={() => afficherOrdre(o)}
                                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                                                        title="Afficher les deux systèmes dans les colonnes"
                                                    >
                                                        {nomObjet(o.code)}
                                                    </span>
                                                </td>
                                                <td style={{ ...td, textAlign: 'left' }}>
                                                    {selectSysteme(posToString(o.de), c => systemeParCle[c] && modifierOrdre(o.id, { de: systemeParCle[c].pos, planeteDe: null }))}{' '}
                                                    {selectPlanete(posToString(o.de), o.planeteDe, p => modifierOrdre(o.id, { planeteDe: p }))}
                                                </td>
                                                <td style={td}>→</td>
                                                <td style={{ ...td, textAlign: 'left' }}>
                                                    {selectSysteme(posToString(o.vers), c => systemeParCle[c] && modifierOrdre(o.id, { vers: systemeParCle[c].pos, planeteVers: null }))}{' '}
                                                    {selectPlanete(posToString(o.vers), o.planeteVers, p => modifierOrdre(o.id, { planeteVers: p }))}
                                                </td>
                                                <td style={{ ...td, textAlign: 'left', color: r ? COULEURS_STATUT[r.statut] : undefined }} title={r?.message}>
                                                    {r ? LIBELLES_STATUT[r.statut] : ''}
                                                    {r?.message && <span style={{ marginLeft: 6, fontSize: '0.85em' }}>{r.message}</span>}
                                                </td>
                                                <td style={td}>
                                                    <button type="button" style={petitBouton} onClick={() => supprimerOrdre(o.id)} title="Supprimer ce transfert">✕</button>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {bilan.length > 0 && (
                <div style={panneau}>
                    <strong style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em' }}>Bilan par système</strong>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '0.9em', marginTop: '4px' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...th, textAlign: 'left' }}>Système</th>
                                    <th style={{ ...th, textAlign: 'left' }}>Objet</th>
                                    <th style={th} title="Stock du rapport">Rapport</th>
                                    <th style={th} title="Effet des transferts programmés">Transferts</th>
                                    <th style={th} title="Stock juste après les transferts">Après transferts</th>
                                    <th style={{ ...th, color: '#4fc3f7' }} title="Production du tour (résolue après les transferts)">Prod. du tour</th>
                                    <th style={th} title="Après transferts + production, hors consommation par les constructions">Fin de tour</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bilan.map(({ cle, lignes }) => lignes.map((l, j) => (
                                    <tr key={`${cle}-${l.code}`} style={{ borderTop: j === 0 ? '1px solid #444' : undefined }}>
                                        <td style={{ ...td, textAlign: 'left' }}>{j === 0 ? nomSysteme(systemeParCle[cle].pos) : ''}</td>
                                        <td style={{ ...td, textAlign: 'left' }}>{nomObjet(l.code)}</td>
                                        <td style={td}>{l.qAvant}</td>
                                        <td style={{ ...td, color: couleurDelta(l.delta) }}>{l.delta !== 0 ? signe(l.delta) : '0'}</td>
                                        <td style={{ ...td, fontWeight: 'bold' }}>{l.qApres}</td>
                                        <td style={{ ...td, color: '#4fc3f7' }}>{l.prod !== 0 ? signe(l.prod) : '—'}</td>
                                        <td style={td}>{l.qApres + l.prod}</td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
