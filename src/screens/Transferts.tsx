import React, { useEffect, useMemo, useState } from 'react';
import { useReport } from '../context/ReportContext';
import { SystemeJoueur, XY } from '../types';
import { posToString } from '../utils/position';
import { copierSchema, deserialiserSchema } from '../utils/ordreSchema';
import {
    CODE_MINERAI, InventaireSysteme, inventaireDuRapport, lireOrdreTransfert, nombreMaxTransferts, nouvelIdTransfert,
    quantite, ResultatTransfert, schemaTransferts, simulerTransferts, TransfertOrdre, typeObjet,
} from '../utils/ordreTransfert';
import { loadTransferts, saveTransferts } from '../storage/transfertsStorage';
import './Transferts.css';

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

// Tri des systèmes par coordonnées : x, puis y
const comparerPositions = (a: XY, b: XY) => a.x - b.x || a.y - b.y;

const LIBELLES_STATUT: Record<ResultatTransfert['statut'], string> = {
    ok: '✓',
    partiel: '⚠ partiel',
    erreur: '✖ erreur',
    ignore: '✖ ignoré',
};

const signe = (n: number) => (n > 0 ? `+${n}` : String(n));
// Classe de couleur d'une variation : ajout en vert, retrait en rouge (Transferts.css)
const classeDelta = (n: number) => (n > 0 ? 'ajout' : n < 0 ? 'retrait' : '');
const classes = (...noms: (string | false | undefined)[]) => noms.filter(Boolean).join(' ');

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

    // Objets d'un système (ou d'une de ses planètes) : bâtiments et marchandises présents avant ou après les transferts
    const objetsDuSysteme = (cle: string, planete: number | null): { batiments: string[]; marchandises: string[] } => {
        const codes = new Set<string>();
        [avant[cle], simulation.apres[cle]].forEach((inv?: InventaireSysteme) => {
            if (!inv) return;
            // Bâtiments des seules planètes du joueur : ceux d'un voisin dans le même système ne sont pas transférables
            inv.planetes.filter(p => p.mienne && (planete === null || p.num === planete)).forEach(p => Object.entries(p.batiments).forEach(([c, n]) => { if (n > 0) codes.add(c); }));
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
        return <div className="transferts-vide">Chargez un rapport pour programmer des transferts.</div>;
    }

    const nomSysteme = (pos: XY) => {
        const s = systemeParCle[posToString(pos)];
        return s ? `${s.nom} (${pos.x}-${pos.y})` : `${pos.x}-${pos.y} (non possédé)`;
    };

    const selectSysteme = (valeur: string | null, onChange: (cle: string) => void) => (
        <select value={valeur ?? ''} onChange={e => onChange(e.target.value)} className="transferts-champ systeme">
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
                className="transferts-champ"
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
                    title={peutEnvoyer ? "Glisser vers l'autre colonne pour programmer un transfert" : undefined}
                >
                    <td className="gauche">{nomObjet(code)}</td>
                    <td>{qAvant}</td>
                    <td className={classeDelta(delta)}>{delta !== 0 ? signe(delta) : ''}</td>
                    <td className={classes('apres', classeDelta(delta))}>{qApres}</td>
                    <td className="prod">{prod !== 0 ? signe(prod) : ''}</td>
                    <td>
                        <button
                            type="button"
                            className="transferts-btn petit"
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

        const objets = cle ? objetsDuSysteme(cle, planete) : { batiments: [], marchandises: [] };
        const groupe = (titre: string, codes: string[]) => (
            <>
                <tr><td colSpan={6} className="groupe">{titre}</td></tr>
                {codes.length === 0
                    ? <tr><td colSpan={6} className="aucun">aucun</td></tr>
                    : codes.map(ligne)}
            </>
        );

        return (
            <div
                className={classes('transferts-panneau', 'transferts-colonne', accepteDepot && 'depot', accepteDepot && survol === i && 'survol')}
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
                <div className="transferts-selecteurs">
                    {selectSysteme(cle, c => choisirSysteme(i, c))}
                    {selectPlanete(cle, planete, p => choisirPlanete(i, p))}
                </div>
                {cle && cle === autre && (
                    <div className="transferts-avertissement">Choisissez deux systèmes différents.</div>
                )}
                <table className="transferts-table pleine">
                    <thead>
                        <tr>
                            <th className="gauche">Objet</th>
                            <th title="Stock du rapport">Rapport</th>
                            <th title="Effet des transferts programmés">Transf.</th>
                            <th title="Stock après les transferts">Après</th>
                            <th className="prod" title="Production du tour (résolue après les transferts)">Prod.</th>
                            <th></th>
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
        <div className="transferts">
            <div className="transferts-entete">
                <h2>Transferts entre systèmes — tour {tour}</h2>
                <span title={detailMax} className={classes('transferts-compteur', depasse && 'depasse')}>
                    Transferts : <strong>{simulation.utilises}</strong> / {max.total}
                </span>
                <div className="transferts-espace" />
                <button type="button" className="transferts-btn" disabled={!schema} onClick={copier}
                        title="Copier le schéma des ordres de transfert à coller dans la console d'ordres">
                    {schemaCopie ? '✓ Schéma copié' : 'Copier le schéma des ordres'}
                </button>
                <button type="button" className="transferts-btn" onClick={() => { setImportOuvert(v => !v); setErreurImport(null); }}
                        title="Remplacer les ordres du tour par ceux d'un schéma">
                    Importer un schéma
                </button>
                <button type="button" className="transferts-btn" disabled={!ordres.length}
                        onClick={() => setOrdres(() => [])} title="Supprimer tous les transferts du tour">
                    ✕ Tout effacer
                </button>
            </div>

            {importOuvert && (
                <div className="transferts-panneau transferts-import">
                    <input
                        value={texteImport}
                        onChange={e => setTexteImport(e.target.value)}
                        placeholder="transfert|…"
                        className="transferts-champ"
                        autoFocus
                    />
                    <button type="button" className="transferts-btn" onClick={importer} disabled={!texteImport.trim()}>Remplacer les ordres</button>
                    {erreurImport && <span className="transferts-erreur">{erreurImport}</span>}
                </div>
            )}

            <div className="transferts-colonnes">
                {colonne(0)}
                {colonne(1)}
            </div>

            <div className="transferts-panneau">
                <strong className="transferts-titre-panneau">Ordres du tour (résolus dans cet ordre)</strong>
                {ordres.length === 0 ? (
                    <div className="transferts-aucun-ordre">
                        Aucun transfert : glissez un objet d'une colonne vers l'autre, ou utilisez ses boutons → / ←.
                    </div>
                ) : (
                    <div className="transferts-defilement">
                        <table className="transferts-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th></th>
                                    <th>Qté</th>
                                    <th className="gauche">Objet</th>
                                    <th className="gauche">De</th>
                                    <th></th>
                                    <th className="gauche">Vers</th>
                                    <th className="gauche">Résultat</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordres.map((o, index) => {
                                    const r = simulation.resultats[o.id];
                                    return (
                                        <React.Fragment key={o.id}>
                                            {index === indexPremierIgnore && (
                                                <tr>
                                                    <td colSpan={9} className="limite">
                                                        limite de {max.total} transferts atteinte : les ordres suivants seront ignorés
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className={r?.statut === 'ignore' ? 'ignore' : undefined}>
                                                <td>{index + 1}</td>
                                                <td>
                                                    <button type="button" className="transferts-btn petit" disabled={index === 0}
                                                            onClick={() => deplacerOrdre(index, -1)} title="Monter">↑</button>
                                                    <button type="button" className="transferts-btn petit" disabled={index === ordres.length - 1}
                                                            onClick={() => deplacerOrdre(index, 1)} title="Descendre">↓</button>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={9999}
                                                        value={o.nombre}
                                                        onChange={e => modifierOrdre(o.id, { nombre: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value) || 0))) })}
                                                        className="transferts-champ quantite"
                                                    />
                                                </td>
                                                <td className="gauche">
                                                    <span
                                                        onClick={() => afficherOrdre(o)}
                                                        className="transferts-lien"
                                                        title="Afficher les deux systèmes dans les colonnes"
                                                    >
                                                        {nomObjet(o.code)}
                                                    </span>
                                                </td>
                                                <td className="gauche">
                                                    {selectSysteme(posToString(o.de), c => systemeParCle[c] && modifierOrdre(o.id, { de: systemeParCle[c].pos, planeteDe: null }))}{' '}
                                                    {selectPlanete(posToString(o.de), o.planeteDe, p => modifierOrdre(o.id, { planeteDe: p }))}
                                                </td>
                                                <td>→</td>
                                                <td className="gauche">
                                                    {selectSysteme(posToString(o.vers), c => systemeParCle[c] && modifierOrdre(o.id, { vers: systemeParCle[c].pos, planeteVers: null }))}{' '}
                                                    {selectPlanete(posToString(o.vers), o.planeteVers, p => modifierOrdre(o.id, { planeteVers: p }))}
                                                </td>
                                                <td className={classes('gauche', r && `statut-${r.statut}`)} title={r?.message}>
                                                    {r ? LIBELLES_STATUT[r.statut] : ''}
                                                    {r?.message && <span className="transferts-message">{r.message}</span>}
                                                </td>
                                                <td>
                                                    <button type="button" className="transferts-btn petit" onClick={() => supprimerOrdre(o.id)} title="Supprimer ce transfert">✕</button>
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
                <div className="transferts-panneau">
                    <strong className="transferts-titre-panneau">Bilan par système</strong>
                    <div className="transferts-defilement">
                        <table className="transferts-table">
                            <thead>
                                <tr>
                                    <th className="gauche">Système</th>
                                    <th className="gauche">Objet</th>
                                    <th title="Stock du rapport">Rapport</th>
                                    <th title="Effet des transferts programmés">Transferts</th>
                                    <th title="Stock juste après les transferts">Après transferts</th>
                                    <th className="prod" title="Production du tour (résolue après les transferts)">Prod. du tour</th>
                                    <th title="Après transferts + production, hors consommation par les constructions">Fin de tour</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bilan.map(({ cle, lignes }) => lignes.map((l, j) => (
                                    <tr key={`${cle}-${l.code}`} className={j === 0 ? 'debut-systeme' : undefined}>
                                        <td className="gauche">{j === 0 ? nomSysteme(systemeParCle[cle].pos) : ''}</td>
                                        <td className="gauche">{nomObjet(l.code)}</td>
                                        <td>{l.qAvant}</td>
                                        <td className={classeDelta(l.delta)}>{l.delta !== 0 ? signe(l.delta) : '0'}</td>
                                        <td className="apres">{l.qApres}</td>
                                        <td className="prod">{l.prod !== 0 ? signe(l.prod) : '—'}</td>
                                        <td>{l.qApres + l.prod}</td>
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
