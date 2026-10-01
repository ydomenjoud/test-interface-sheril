import {FlotteDetectee, Rapport, XY} from '../types';

// Stockage des rapports extraits, un par tour, dans IndexedDB (le localStorage est trop petit pour plusieurs tours).
// Chaque rapport est stocké avec les seules détections de son tour (sans la fusion avec les tours précédents).

const DB_NAME = 'sheril';
const DB_VERSION = 2;
const STORE = 'rapports'; // clé = numéro de tour
const FLEETS_STORE = 'flottes'; // résumé léger par tour, pour retrouver les dernières flottes vues sur une case

// Flottes détectées à un tour, et ce que le joueur pouvait voir à ce tour (positions + portée de scan)
export type FleetSnapshot = {
    tour: number;
    flottes: FlotteDetectee[];
    observateurs: { pos: XY; scan: number }[];
};

export function fleetSnapshotOf(r: Rapport): FleetSnapshot {
    return {
        tour: r.tour,
        flottes: r.flottesDetectees,
        observateurs: [...r.systemesJoueur, ...r.flottesJoueur]
            .filter(o => Number(o.scan) > 0)
            .map(o => ({pos: o.pos, scan: Number(o.scan)})),
    };
}

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB indisponible'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (event) => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'tour'});
                if (!db.objectStoreNames.contains(FLEETS_STORE)) {
                    const fleets = db.createObjectStore(FLEETS_STORE, {keyPath: 'tour'});
                    // Passage de la v1 : on construit le résumé des flottes des rapports déjà stockés
                    if (event.oldVersion >= 1 && req.transaction) {
                        req.transaction.objectStore(STORE).openCursor().onsuccess = (e) => {
                            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
                            if (!cursor) return;
                            fleets.put(fleetSnapshotOf(cursor.value as Rapport));
                            cursor.continue();
                        };
                    }
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        dbPromise.catch(() => { dbPromise = undefined; }); // permettre une nouvelle tentative
    }
    return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return openDb().then(db => new Promise<T>((resolve, reject) => {
        const req = op(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    }));
}

// Enregistre (ou remplace) le rapport de son tour, avec le résumé de ses flottes
export function saveRapport(r: Rapport): Promise<void> {
    return openDb().then(db => new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE, FLEETS_STORE], 'readwrite');
        tx.objectStore(STORE).put(r);
        tx.objectStore(FLEETS_STORE).put(fleetSnapshotOf(r));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    }));
}

// Résumés des flottes de tous les tours stockés
export function getFleetSnapshots(): Promise<FleetSnapshot[]> {
    return openDb().then(db => new Promise<FleetSnapshot[]>((resolve, reject) => {
        const req = db.transaction(FLEETS_STORE, 'readonly').objectStore(FLEETS_STORE).getAll();
        req.onsuccess = () => resolve(req.result as FleetSnapshot[]);
        req.onerror = () => reject(req.error);
    }));
}

export function getRapport(tour: number): Promise<Rapport | undefined> {
    return run('readonly', s => s.get(tour) as IDBRequest<Rapport | undefined>);
}

// Tours disponibles, du plus ancien au plus récent
export function listTours(): Promise<number[]> {
    return run('readonly', s => s.getAllKeys()).then(keys => keys.map(Number).sort((a, b) => a - b));
}

export async function getLatestRapport(): Promise<Rapport | undefined> {
    const tours = await listTours();
    return tours.length ? getRapport(tours[tours.length - 1]) : undefined;
}

// Rapports des tours inférieurs ou égaux au tour donné, du plus ancien au plus récent
export function getRapportsUpTo(tour: number): Promise<Rapport[]> {
    return run('readonly', s => s.getAll(IDBKeyRange.upperBound(tour)) as IDBRequest<Rapport[]>)
        .then(list => list.sort((a, b) => a.tour - b.tour));
}
