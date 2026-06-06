import React, {useEffect, useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import {Technologie} from '../types';
import SearchableSelect from '../components/utils/SearchableSelect';
import {useSearchParams} from 'react-router-dom';
import {encodeBluePrint, toRoman} from "../utils/global";

type Entry = { code: string; qty: number };

export default function CreatePlan() {
    const {global, rapport} = useReport();
    const [onlyKnown, setOnlyKnown] = useState<boolean>(false);
    const [compTechs, setCompTechs] = useState<Technologie[]>([]);


    // Activer le filtre par défaut si un rapport est chargé
    useEffect(() => {
        if (rapport) {
            setOnlyKnown(true);
        }
    }, [rapport]);

    useEffect(() => {
        let list = (global?.technologies ?? []).filter(t => t.type === 1);
        // garder uniquement les composants
        list = list.filter(t => (t.type === 1));
        // on va virer les cargo inutilités
        list = list.filter(t => t.base !== 'cargo')

        if (onlyKnown && rapport) {
            const connues = new Set(rapport.technologiesConnues);
            list = list.filter(t => connues.has(t.code));
        }

        setCompTechs(list);
    }, [global?.technologies, global?.technologies?.length, onlyKnown, rapport]);

    const techByCode = useMemo(() => {
        const map = new Map<string, Technologie>();
        const list = (global?.technologies ?? []).filter(t => t.type === 1);
        list.forEach(t => map.set(t.code, t));
        return map;
    }, [global]);

    // Codes de caractéristiques
    const techCharCodes = useMemo(() => {
        const dict = global?.caracteristiquesComposant || {};
        let propulsion = 0;
        let detection = 0;
        let construction = 0;
        for (const [k, v] of Object.entries(dict)) {
            const lower = (v || '').toLowerCase();
            if (lower === 'propulsion') propulsion = Number(k);
            else if (lower === 'portée détection' || lower === 'portee detection' || lower === 'détection') detection = Number(k);
            else if (lower === 'module de construction' || lower === 'construction') construction = Number(k);
        }
        return {propulsion, detection, construction};
    }, [global]);

    const [selectedCode, setSelectedCode] = useState<string>('');
    const [selectedQty, setSelectedQty] = useState<number>(1);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();

    // Chargement initial du blueprint depuis l'URL
    useEffect(() => {

        let bp = searchParams.get('bp');

        if (bp && global?.technologies) {
            try {
                // Si le blueprint actuel est déjà le même que celui de l'URL, on ne fait rien
                if (bp === blueprint) return;

                const decoded = atob(bp);
                // Le format attendu est code1:qty1%code2:qty2...
                const items = decoded.split('%');
                const newEntries: Entry[] = [];
                for (const item of items) {
                    const parts = item.split(':').map(s => s.trim());
                    if (parts.length === 2) {
                        const code = parts[0];
                        const qty = parseInt(parts[1], 10);
                        if (code && !isNaN(qty)) {
                            newEntries.push({code, qty});
                        }
                    }
                }
                if (newEntries.length > 0) {
                    setEntries(newEntries);
                }
            } catch (e) {
                console.error("Erreur lors du décodage du blueprint:", e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [global?.technologies, searchParams]);

    const blueprint = encodeBluePrint(entries);

    const copyBluePrint = () => {
        navigator.clipboard.writeText(blueprint)
            .catch(err => console.error("Erreur lors de la copie du lien:", err));
    };

    // Mise à jour de l'URL quand le blueprint change
    useEffect(() => {
        if (entries.length > 0) {
            setSearchParams({bp: blueprint}, {replace: true});
        }
    }, [blueprint, setSearchParams, entries.length]);

    function addEntry() {
        const code = selectedCode || compTechs[0]?.code;
        if (!code) return;
        const qty = Math.max(1, Math.floor(selectedQty || 1));

        const tech = techByCode.get(code);
        const isConstruction = tech?.caracteristiques?.some(c => c.code === techCharCodes.construction);

        setEntries(prev => {
            // Si c'est un module de construction, on vérifie s'il y en a déjà un ailleurs
            if (isConstruction) {
                const hasOtherConstruction = prev.some(e => {
                    const t = techByCode.get(e.code);
                    return t?.caracteristiques?.some(c => c.code === techCharCodes.construction);
                });
                if (hasOtherConstruction) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                    return prev;
                }
                if (qty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                    return [...prev, {code, qty: 1}];
                }
            }

            const idx = prev.findIndex(e => e.code === code);
            if (idx >= 0) {
                const copy = prev.slice();
                let newQty = copy[idx].qty + qty;
                if (isConstruction && newQty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                    newQty = 1;
                }
                copy[idx] = {...copy[idx], qty: newQty};
                return copy;
            }
            return [...prev, {code, qty}];
        });

        setSelectedCode('');
        setSelectedQty(1);
    }

    function setQty(code: string, qty: number) {
        const tech = techByCode.get(code);
        const isConstruction = tech?.caracteristiques?.some(c => c.code === techCharCodes.construction);
        let finalQty = Math.max(0, Math.floor(qty || 0));
        if (isConstruction && finalQty > 1) {
            alert("Un seul module de construction est autorisé par vaisseau.");
            finalQty = 1;
        }
        setEntries(prev => prev.map(e => e.code === code ? {...e, qty: finalQty} : e));
    }

    function remove(code: string) {
        setEntries(prev => prev.filter(e => e.code !== code));
    }

    function upgradeEntry(code: string) {
        const tech = techByCode.get(code);
        if (!tech) return;

        // Trouver une technologie avec la même base et le niveau immédiatement supérieur
        const nextLevelTech = Array.from(global?.technologies || []).find(t =>
            t.type === 1 && t.base === tech.base && t.niv === tech.niv + 1
        );

        if (!nextLevelTech) return;

        setEntries(prev => {
            const idx = prev.findIndex(e => e.code === code);
            if (idx === -1) return prev;

            const newEntries = [...prev];
            const currentQty = newEntries[idx].qty;

            // Vérifier si la version supérieure existe déjà dans les entrées
            const existingNextIdx = newEntries.findIndex(e => e.code === nextLevelTech.code);

            if (existingNextIdx !== -1) {
                // Fusionner avec l'existant
                let newQty = newEntries[existingNextIdx].qty + currentQty;
                const isConstruction = nextLevelTech?.caracteristiques?.some(c => c.code === techCharCodes.construction);
                if (isConstruction && newQty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                    newQty = 1;
                }
                newEntries[existingNextIdx] = {
                    ...newEntries[existingNextIdx],
                    qty: newQty
                };
                // Supprimer l'ancien
                newEntries.splice(idx, 1);
            } else {
                // Remplacer par le nouveau
                const isConstruction = nextLevelTech?.caracteristiques?.some(c => c.code === techCharCodes.construction);
                const finalQty = (isConstruction && currentQty > 1) ? 1 : currentQty;
                if (isConstruction && currentQty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                }
                newEntries[idx] = {code: nextLevelTech.code, qty: finalQty};
            }

            return newEntries;
        });
    }

    function downgradeEntry(code: string) {
        const tech = techByCode.get(code);
        if (!tech) return;

        // Trouver une technologie avec la même base et le niveau immédiatement inférieur
        const prevLevelTech = Array.from(global?.technologies || []).find(t =>
            t.type === 1 && t.base === tech.base && t.niv === tech.niv - 1
        );

        if (!prevLevelTech) return;

        setEntries(prev => {
            const idx = prev.findIndex(e => e.code === code);
            if (idx === -1) return prev;

            const newEntries = [...prev];
            const currentQty = newEntries[idx].qty;

            // Vérifier si la version inférieure existe déjà dans les entrées
            const existingPrevIdx = newEntries.findIndex(e => e.code === prevLevelTech.code);

            if (existingPrevIdx !== -1) {
                // Fusionner avec l'existant
                let newQty = newEntries[existingPrevIdx].qty + currentQty;
                const isConstruction = prevLevelTech?.caracteristiques?.some(c => c.code === techCharCodes.construction);
                if (isConstruction && newQty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                    newQty = 1;
                }
                newEntries[existingPrevIdx] = {
                    ...newEntries[existingPrevIdx],
                    qty: newQty
                };
                // Supprimer l'ancien
                newEntries.splice(idx, 1);
            } else {
                // Remplacer par le nouveau
                const isConstruction = prevLevelTech?.caracteristiques?.some(c => c.code === techCharCodes.construction);
                const finalQty = (isConstruction && currentQty > 1) ? 1 : currentQty;
                if (isConstruction && currentQty > 1) {
                    alert("Un seul module de construction est autorisé par vaisseau.");
                }
                newEntries[idx] = {code: prevLevelTech.code, qty: finalQty};
            }

            return newEntries;
        });
    }

    // Calculs
    const totals = useMemo(() => {
        let totalCase = 0;
        let totalMinerai = 0;
        let totalPrix = 0;
        const marchTotals = new Map<number, number>();
        const charTotals = new Map<number, number>();
        let propulsionMax = 0;
        let detectionMax = 0;
        let hasConstructionModule = false;
        let multipleConstructionError = false;
        const missingTechs: string[] = [];

        for (const e of entries) {
            const t = techByCode.get(e.code);
            if (!t || e.qty <= 0) continue;

            if (rapport && !rapport.technologiesConnues.includes(e.code)) {
                missingTechs.push(`${t.nom} (type ${toRoman(t.niv)})`);
            }

            const s = t.specification || {};
            const unitCase = s.case ?? 0;
            const unitMin = s.min ?? 0;
            const unitPrix = s.prix ?? 0;

            totalCase += unitCase * e.qty;
            totalMinerai += unitMin * e.qty;
            totalPrix += unitPrix * e.qty;

            // Caractéristiques
            for (const char of (t.caracteristiques || [])) {
                if (char.code === techCharCodes.propulsion) {
                    if (char.value > propulsionMax) propulsionMax = char.value;
                } else if (char.code === techCharCodes.detection) {
                    if (char.value > detectionMax) detectionMax = char.value;
                } else {
                    if (char.code === techCharCodes.construction) {
                        if (hasConstructionModule || e.qty > 1) multipleConstructionError = true;
                        hasConstructionModule = true;
                    }
                    charTotals.set(char.code, (charTotals.get(char.code) || 0) + char.value * e.qty);
                }
            }

            // marchandises par composant
            for (const m of (t.marchandises ?? [])) {
                marchTotals.set(m.code, (marchTotals.get(m.code) || 0) + m.nb * e.qty);
            }
        }

        // Taille / vitesse selon règles
        let taille = undefined as number | undefined;
        let baseSpeed = 0;
        if (global?.tailleVaisseaux?.length) {
            const found = global.tailleVaisseaux.find(r => totalCase >= r.minCase && (r.maxCase === 0 || totalCase <= r.maxCase));
            const rule = found ?? global.tailleVaisseaux[global.tailleVaisseaux.length - 1];
            if (rule) {
                taille = rule.taille;
                baseSpeed = rule.vitesse ?? 0;
            }
        }

        // Vitesse finale: si aucune propulsion, 0 ; sinon base + max propulsion
        const vitesse = propulsionMax > 0 ? baseSpeed + propulsionMax : 0;

        return {
            totalCase, totalMinerai, totalPrix, marchTotals, charTotals,
            taille, baseSpeed, propulsionMax, detectionMax, vitesse,
            multipleConstructionError,
            missingTechs
        };
    }, [entries, techByCode, global, techCharCodes, rapport]);

    const isConstructible = useMemo(() => {
        if (!rapport) return true; // Si pas de rapport, on ne sait pas, on ne bloque pas l'indicateur par défaut ou on gère autrement ? L'utilisateur dit "si on ne connait pas", donc si on n'a pas chargé le rapport, on ne peut pas affirmer qu'il ne connait pas. Mais le bouton "Seulement connues" est grisé si pas de rapport.
        return totals.missingTechs.length === 0;
    }, [totals.missingTechs, rapport]);

    const charList = useMemo(() => {
        const out: { code: number; nom: string; value: number }[] = [];
        totals.charTotals.forEach((value, code) => {
            const nom = global?.caracteristiquesComposant[code] ?? String(code);
            out.push({code, nom, value});
        });
        // Ajouter les caractéristiques non cumulables
        if (totals.propulsionMax > 0) {
            const nom = global?.caracteristiquesComposant[techCharCodes.propulsion] || 'Propulsion';
            out.push({code: techCharCodes.propulsion, nom, value: totals.propulsionMax});
        }
        if (totals.detectionMax > 0) {
            const nom = global?.caracteristiquesComposant[techCharCodes.detection] || 'Détection';
            out.push({code: techCharCodes.detection, nom, value: totals.detectionMax});
        }
        out.sort((a, b) => a.code - b.code);
        return out;
    }, [totals.charTotals, totals.propulsionMax, totals.detectionMax, global, techCharCodes]);

    const marchList = useMemo(() => {
        const out: { code: number; nom: string; nb: number }[] = [];
        totals.marchTotals.forEach((nb, code) => {
            const nom = global?.marchandises.find(m => m.code === code)?.nom ?? String(code);
            out.push({code, nom, nb});
        });
        out.sort((a, b) => a.code - b.code);
        return out;
    }, [totals.marchTotals, global]);


    const caractArmes = {
        degat_bouclier: 0,
        degat_coque: 0,
        degat_sol: 0,
    }

    entries.forEach(({qty, code}) => {
        const t = techByCode.get(code);
        if(!t){ return }
        if(t.arme){
            const {degat_bouclier, degat_coque, degat_sol} = t.arme;
            caractArmes.degat_bouclier += qty * degat_bouclier;
            caractArmes.degat_coque += qty * degat_coque;
            caractArmes.degat_sol += qty * degat_sol;
        }
    })

    return (
        <div style={{padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column'}}>
      <h3>Simulateur de création de plan de vaisseau</h3>

      <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12}}>
        <div>
          <div style={{marginBottom: 4}}>Composant:</div>
          <SearchableSelect
              options={compTechs.map(t => ({
                  value: t.code,
                  label: `${t.nom} (type ${toRoman(t.niv)}) [${t.code}] — ${t.specification?.case ?? 0} case, min ${t.specification?.min ?? 0}, prix ${t.specification?.prix ?? 0}`
              }))}
              value={selectedCode}
              onChange={setSelectedCode}
              placeholder="Rechercher un composant…"
              style={{minWidth: 380}}
          />
        </div>
        <label>
          Quantité:
          <input
              type="number"
              min={1}
              value={selectedQty}
              onChange={e => setSelectedQty(parseInt(e.target.value || '1', 10))}
              style={{width: 80, marginLeft: 6}}
          />
        </label>
        <button onClick={addEntry} disabled={compTechs.length === 0 && !selectedCode}>Ajouter</button>

        <button
            onClick={() => setOnlyKnown(!onlyKnown)}
            disabled={!rapport}
            title={!rapport ? "Veuillez charger votre rapport XML pour filtrer par technologies connues" : ""}
            style={{
                marginLeft: 12,
                backgroundColor: onlyKnown ? '#2e7d32' : '#37474f',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: 4,
                cursor: rapport ? 'pointer' : 'not-allowed',
                opacity: rapport ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6
            }}
        >
            {onlyKnown ? '✓ ' : ''}Seulement technologies connues
        </button>

      </div>

      <div style={{overflow: 'auto'}}>
        <table className="tech-table" style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th style={{width: '350px'}}>Composant</th>
              <th style={{textAlign: 'right'}}>Case</th>
              <th style={{textAlign: 'right'}}>Minerai</th>
              <th style={{textAlign: 'right'}}>Prix</th>
              <th>Marchandises (unité)</th>
              <th style={{textAlign: 'right'}}>Qté</th>
              <th style={{textAlign: 'right'}}>Case tot.</th>
              <th style={{textAlign: 'right'}}>Minerai tot.</th>
              <th style={{textAlign: 'right'}}>Prix tot.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
                const t = techByCode.get(e.code);
                if (!t) return null;
                const s = t.specification || {};
                const unitCase = s.case ?? 0;
                const unitMin = s.min ?? 0;
                const unitPrix = s.prix ?? 0;
                const marchUnit = (t.marchandises ?? []).map((m, i) => {
                    const nom = global?.marchandises.find(mm => mm.code === m.code)?.nom ?? String(m.code);
                    return <span key={i} className="badge">{nom}: <span className="information">{m.nb}</span></span>;
                });

                const nextLevelTech = Array.from(global?.technologies || []).find(nt =>
                    nt.type === 1 && nt.base === t.base && nt.niv === t.niv + 1
                );
                const prevLevelTech = Array.from(global?.technologies || []).find(pt =>
                    pt.type === 1 && pt.base === t.base && pt.niv === t.niv - 1
                );

                const isKnown = !rapport || rapport.technologiesConnues.includes(e.code);

                return (
                    <tr key={e.code} style={{backgroundColor: isKnown ? 'transparent' : 'rgba(255, 0, 0, 0.1)'}}>
                  <td>
                    {t.nom} de type {toRoman(t.niv)}
                      {!isKnown && <span style={{color: '#ff4444', marginLeft: 8, fontWeight: 'bold'}}
                                         title="Technologie inconnue ou niveau insuffisant">⚠</span>}
                      <div style={{
                          display: 'inline-flex',
                          gap: 4,
                          marginLeft: 8,
                          verticalAlign: 'middle',
                          float: 'right'
                      }}>
                        <button disabled={!nextLevelTech}
                                onClick={() => upgradeEntry(e.code)}
                                title={`Upgrader vers ${nextLevelTech?.nom} (type ${toRoman(nextLevelTech?.niv || 1)})`}
                                style={{
                                    padding: '0 4px',
                                    fontSize: '0.8em',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    border: '1px solid #666',
                                    background: '#234',
                                    color: '#fff'
                                }}
                        >
                          ▲
                        </button>
                        <button disabled={!prevLevelTech}
                                onClick={() => downgradeEntry(e.code)}
                                title={`Rétrograder vers ${prevLevelTech?.nom} (type ${toRoman(prevLevelTech?.niv || 1)})`}
                                style={{
                                    padding: '0 4px',
                                    fontSize: '0.8em',
                                    cursor: 'pointer',
                                    borderRadius: 4,
                                    border: '1px solid #666',
                                    background: '#432',
                                    color: '#fff'
                                }}
                        >
                          ▼
                        </button>
                    </div>
                  </td>
                  <td style={{textAlign: 'right'}}>{unitCase}</td>
                  <td style={{textAlign: 'right'}}>{unitMin}</td>
                  <td style={{textAlign: 'right'}}>{unitPrix}</td>
                  <td style={{whiteSpace: 'normal'}}>{marchUnit.length ? marchUnit : '—'}</td>
                  <td style={{textAlign: 'right'}}>
                    <input
                        type="number"
                        min={1}
                        value={e.qty}
                        onChange={ev => setQty(e.code, parseInt(ev.target.value || '1', 10))}
                        style={{width: 80}}
                    />

                  </td>
                  <td style={{textAlign: 'right'}}>{unitCase * e.qty}</td>
                  <td style={{textAlign: 'right'}}>{unitMin * e.qty}</td>
                  <td style={{textAlign: 'right'}}>{(unitPrix * e.qty).toFixed(1)}</td>
                  <td>
                    <button onClick={() => remove(e.code)} title="Retirer ce composant"
                            style={{marginLeft: 6}}>Suppr.</button>
                  </td>
                </tr>
                );
            })}
            {entries.length === 0 && (
                <tr>
                <td colSpan={10} style={{textAlign: 'center', padding: 12, color: '#aaa'}}>
                  Ajoutez des composants pour composer votre plan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center'}}>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Taille: <b>{totals.taille ?? '—'}</b>
        </div>
        <div className="badge"
             style={{background: '#123', color: '#ddd', display: 'flex', alignItems: 'center', gap: 8}}>
          Vitesse: <b>{Number.isFinite(totals.vitesse) ? totals.vitesse : '—'}</b>
            {entries.length > 0 && totals.propulsionMax === 0 && (
                <span style={{color: '#f0c040'}} title="Aucun composant de propulsion sélectionné — vitesse fixée à 0">
              ⚠ aucun moteur (vitesse 0)
            </span>
            )}
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Cases: <b>{totals.totalCase}</b>
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          PDC: <b>{Math.max(1, Math.floor(totals.totalCase / 2))}</b>
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Minerai: <b>{totals.totalMinerai}</b>
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Prix: <b>{totals.totalPrix.toFixed(1)}</b>
        </div>
      </div>

    <div className={"split4"}>
      <div style={{marginTop: 12}}>
        <h4>Marchandises totales</h4>
          {marchList.length === 0 ? (
              <div style={{color: '#aaa'}}>Aucune marchandise requise.</div>
          ) : (
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            {marchList.map(m => (
                <span key={m.code} className="badge">
                {m.nom}: <span className="information">{m.nb}</span>
              </span>
            ))}
          </div>
          )}
      </div>

      <div style={{marginTop: 12}}>
        <h4>Caractéristiques générales</h4>
          {totals.multipleConstructionError && (
              <div style={{color: '#ff4444', marginBottom: 8, fontWeight: 'bold'}}>
            ⚠ Erreur : Un seul module de construction est autorisé par vaisseau.
          </div>
          )}
          {charList.length === 0 ? (
              <div style={{color: '#aaa'}}>Aucune caractéristique particulière.</div>
          ) : (
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            {charList.map(c => (
                <span key={c.code} className="badge" style={{background: '#231'}}>
                {c.nom}: <span className="information">{c.value}</span>
              </span>
            ))}
          </div>
          )}
      </div>
     <div style={{marginTop: 12}}>
        <h4 style={{display: 'flex', alignItems: 'center', gap: 10}}>Armes</h4>
        <span className={""}> Dégats coque :
            <span className={"information"}> {caractArmes.degat_coque}</span>
        </span><br />
        <span className=""> Dégats bouclier :
            <span className={"information"}> {caractArmes.degat_bouclier}</span>
        </span><br />
        <span className=""> Dégats sol :
            <span className={"information"}> {caractArmes.degat_sol}</span>
        </span><br />
     </div>

     <div style={{marginTop: 12}}>
        <h4 style={{display: 'flex', alignItems: 'center', gap: 10}}>
            Schéma de création
      </h4>
         <div>
            {entries.length > 0 && rapport && (
                isConstructible ? (
                    <span className="badge"
                          style={{background: '#2e7d32', color: 'white', fontSize: '0.7em'}}>Constructible</span>
                ) : (
                    <span className="badge" style={{background: '#c62828', color: 'white', fontSize: '0.7em'}}
                          title={`Technologies manquantes: ${totals.missingTechs.join(', ')}`}>
                        Non constructible (technologies manquantes)
                    </span>
                )
            )}</div>
        <textarea
            style={{width: '100%', backgroundColor: 'white', padding: '10px', color: '#000'}}
            defaultValue={blueprint}
            readOnly={true}
            onFocus={(e) => e.target.select()}
        ></textarea>
           <button
               onClick={copyBluePrint}
               disabled={entries.length === 0}
               style={{
                   backgroundColor: '#2c3e50',
                   color: 'white',
                   border: 'none',
                   padding: '8px 16px',
                   borderRadius: 4,
                   cursor: 'pointer'
               }}
           >
            Copier le schema dans le presse-papier
        </button>
     </div>
    </div>
    </div>
    );
}
