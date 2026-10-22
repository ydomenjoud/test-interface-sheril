import React from 'react';
import {act, renderHook} from '@testing-library/react';
import {loadDeplacements, saveDeplacements, clearAllDeplacements} from '../../../storage/deplacementOrdersStorage';
import {useStoredFleetOrders} from './useStoredFleetOrders';

const orders = {0: {to: {x: 20, y: 4}, directive: 1, strategy: ''}};
const wrapper = ({children}: {children: React.ReactNode}) => <React.StrictMode>{children}</React.StrictMode>;
const report = {};

describe('fleet-order hydration without destructive writes', () => {
    beforeEach(() => localStorage.clear());
    it('retains a saved draft when an asynchronous report arrives, including repeated report objects', () => {
        saveDeplacements(16, orders);
        const {result, rerender} = renderHook(({tour, version}) => useStoredFleetOrders(tour, version, 0), {
            initialProps: {tour: undefined as number | undefined, version: undefined as object | undefined}, wrapper,
        });
        rerender({tour: 16, version: {}});
        rerender({tour: 16, version: {}});
        expect(result.current[0]).toEqual(orders);
        expect(loadDeplacements(16)).toEqual(orders);
    });
    it('does not overwrite one turn with the previous turn on navigation', () => {
        const next = {2: {to: {x: 1, y: 1}, directive: 0, strategy: 'prudent'}};
        saveDeplacements(16, orders);
        saveDeplacements(17, next);
        const {result, rerender} = renderHook(({tour}) => useStoredFleetOrders(tour, report, 0), {
            initialProps: {tour: 16}, wrapper,
        });
        rerender({tour: 17});
        expect(result.current[0]).toEqual(next);
        expect(loadDeplacements(16)).toEqual(orders);
        expect(loadDeplacements(17)).toEqual(next);
    });
    it('honours the existing import reset without resurrecting the in-memory draft', () => {
        saveDeplacements(16, orders);
        const {result, rerender} = renderHook(({revision}) => useStoredFleetOrders(16, report, revision), {
            initialProps: {revision: 0}, wrapper,
        });
        clearAllDeplacements();
        rerender({revision: 1});
        expect(result.current[0]).toEqual({});
        expect(loadDeplacements(16)).toEqual({});
    });
    it('still saves edits and clear operations through the existing storage schema', () => {
        const {result} = renderHook(() => useStoredFleetOrders(16, report, 0), {wrapper});
        act(() => result.current[1](previous => ({...previous, ...orders})));
        expect(loadDeplacements(16)).toEqual(orders);
        act(() => result.current[1]({}));
        expect(loadDeplacements(16)).toEqual({});
    });
});
