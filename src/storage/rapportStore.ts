import {Rapport} from '../types';

// Stockage des rapports extraits, un par tour, dans IndexedDB (le localStorage est trop petit pour plusieurs tours).
// Chaque rapport est stocké avec les seules détections de son tour (sans la fusion avec les tours précédents).

const DB_NAME = 'sheril';
const DB_VERSION = 1;
const STORE = 'rapports'; // clé = numéro de tour

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB indisponible'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'tour'});
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

// Enregistre (ou remplace) le rapport de son tour
export function saveRapport(r: Rapport): Promise<void> {
    return run('readwrite', s => s.put(r)).then(() => undefined);
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
