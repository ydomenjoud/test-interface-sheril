import React, {useEffect, useMemo, useState} from 'react';
import {useReport} from '../context/ReportContext';
import {Technologie} from '../types';
import SearchableSelect from '../components/utils/SearchableSelect';
import {useSearchParams} from 'react-router-dom';

type Entry = { code: string; qty: number };

export default function CreatePlan() {
    const {global} = useReport();

    const compTechs = useMemo(() => {
        const list = (global?.technologies ?? []).filter(t => t.type === 1);
        // garder uniquement celles avec une specification.case (composants pertinents)
        return list.filter(t => (t.specification?.case ?? 0) > 0);
    }, [global]);

    const techByCode = useMemo(() => {
        const map = new Map<string, Technologie>();
        compTechs.forEach(t => map.set(t.code, t));
        return map;
    }, [compTechs]);

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

    // Chargement du blueprint depuis l'URL
    useEffect(() => {
        const bp = searchParams.get('bp');
        if (bp && global?.technologies) {
            try {
                const decoded = atob(bp);
                const lines = decoded.split('\n');
                const newEntries: Entry[] = [];
                for (const line of lines) {
                    const parts = line.split('%').map(s => s.trim());
                    if (parts.length === 2) {
                        const qty = parseInt(parts[0], 10);
                        const code = parts[1];
                        if (!isNaN(qty) && code) {
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
    }, [global, searchParams, entries.length]); // On attend que global soit chargé pour avoir les technos (même si on en a pas besoin pour remplir entries, c'est plus sûr pour la cohérence visuelle immédiate)

    const blueprint = btoa(entries
        .map(e => `${e.qty} % ${e.code}`)
        .join('\n'));

    const copyShareLink = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('bp', blueprint);
        navigator.clipboard.writeText(url.toString())
            .then(() => alert("Lien de partage copié dans le presse-papier !"))
            .catch(err => console.error("Erreur lors de la copie du lien:", err));
    };

    // Mise à jour de l'URL quand le blueprint change
    useEffect(() => {
        if (entries.length > 0) {
            setSearchParams({bp: blueprint}, {replace: true});
        } else {
            setSearchParams({}, {replace: true});
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
        const nextLevelTech = Array.from(techByCode.values()).find(t =>
            t.base === tech.base && t.niv === tech.niv + 1
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
        const prevLevelTech = Array.from(techByCode.values()).find(t =>
            t.base === tech.base && t.niv === tech.niv - 1
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

        for (const e of entries) {
            const t = techByCode.get(e.code);
            if (!t || e.qty <= 0) continue;
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
            multipleConstructionError
        };
    }, [entries, techByCode, global, techCharCodes]);

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

    const toRoman = (n: number) => {
        const map: [number, string][] = [
            [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
        ];
        let res = '';
        let num = n + 1;
        for (const [val, rom] of map) {
            while (num >= val) {
                res += rom;
                num -= val;
            }
        }
        return res;
    };


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

      </div>

      <div style={{overflow: 'auto'}}>
        <table className="tech-table" style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th style={{width: 300}}>Composant</th>
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

                const nextLevelTech = Array.from(techByCode.values()).find(nt =>
                    nt.base === t.base && nt.niv === t.niv + 1
                );
                const prevLevelTech = Array.from(techByCode.values()).find(pt =>
                    pt.base === t.base && pt.niv === t.niv - 1
                );

                return (
                    <tr key={e.code}>
                  <td>
                    {t.nom} de type {toRoman(t.niv)}
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
                        min={0}
                        value={e.qty}
                        onChange={ev => setQty(e.code, parseInt(ev.target.value || '0', 10))}
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
          PDC: <b>{Math.floor(totals.totalCase / 2)}</b>
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Minerai: <b>{totals.totalMinerai}</b>
        </div>
        <div className="badge" style={{background: '#123', color: '#ddd'}}>
          Prix: <b>{totals.totalPrix.toFixed(1)}</b>
        </div>
      </div>

    <div className={"split3"}>
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
        <h4>Schéma de création
        <button
            onClick={copyShareLink}
            disabled={entries.length === 0}
            style={{backgroundColor: '#2c3e50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer'}}
        >
            Partager le schéma
        </button></h4>
        <textarea
            style={{width: '100%', backgroundColor: 'white', padding: '10px', color: '#000'}}
            defaultValue={blueprint}
            readOnly={true}
            onFocus={(e) => e.target.select()}
        ></textarea>
     </div>
    </div>
    </div>
    );
}
