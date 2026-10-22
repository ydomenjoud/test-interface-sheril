import {Dispatch, SetStateAction, useCallback, useEffect, useState} from 'react';
import {loadDeplacements, saveDeplacements} from '../../../storage/deplacementOrdersStorage';
import {DeplacementEnAttente} from '../../../utils/ordreDeplacement';

type Orders = Record<number, DeplacementEnAttente>;
type Stored = {tour?: number; report?: object; importCount: number; orders: Orders};

/** Ne jamais sauver l'état de l'ancien rapport pendant l'hydratation du suivant (StrictMode inclus). */
export function useStoredFleetOrders(tour: number | undefined, report: object | undefined, importCount: number) {
    const [stored, setStored] = useState<Stored>(() => ({tour, report, importCount,
        orders: tour === undefined ? {} : loadDeplacements(tour)}));
    const hydrated = stored.tour === tour && stored.report === report && stored.importCount === importCount;
    useEffect(() => {
        setStored(previous => previous.tour === tour && previous.report === report && previous.importCount === importCount
            ? previous : {tour, report, importCount, orders: tour === undefined ? {} : loadDeplacements(tour)});
    }, [tour, report, importCount]);
    useEffect(() => {
        if (hydrated && tour !== undefined) saveDeplacements(tour, stored.orders);
    }, [hydrated, tour, stored.orders]);
    const setOrders = useCallback<Dispatch<SetStateAction<Orders>>>(update => {
        setStored(previous => {
            const orders = previous.tour === tour && previous.report === report && previous.importCount === importCount
                ? previous.orders : tour === undefined ? {} : loadDeplacements(tour);
            return {tour, report, importCount, orders: typeof update === 'function' ? update(orders) : update};
        });
    }, [tour, report, importCount]);
    // Un changement de rapport ne laisse pas afficher les anciens ordres pendant sa lecture.
    return [hydrated ? stored.orders : {}, setOrders] as const;
}
