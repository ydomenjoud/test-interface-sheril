import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FleetRoster from './FleetRoster';
import {ALL_FLEET_SIZE_BANDS, buildFleetCells, MapFleet} from '../../../utils/fleetModel';

const pos = {x: 19, y: 6};
const foreign = (owner: number, num: number, puiss: string): MapFleet => ({
    type: 'detecte', owner, proprio: owner, num, nom: `Contact ${owner}-${num}`, pos, nbVso: 2, puiss,
});
const own: MapFleet = {type: 'joueur', owner: 1, proprio: 1, num: 0, nom: 'Éclaireuse', pos, nbVso: 3,
    vitesse: 4, scan: 2, as: 1200, ap: 100, directive: 0, vaisseaux: []};
const fleets = [own, foreign(7, 1, 'grande'), foreign(7, 2, 'moyenne'), foreign(12, 1, 'inconnue')];
const full = buildFleetCells(fleets, ALL_FLEET_SIZE_BANDS).get('19_6')!;
const props = {summary: full, getOwnerName: (owner: number) => owner === 1 ? 'Vous' : `Commandant ${owner}`,
    getOwnerColor: () => '#ef4444'};

describe('grouped fleet inspection', () => {
    it('shows all owners, distinguishing two commanders of the same colour', () => {
        render(<FleetRoster {...props} />);
        expect(screen.getByText('4/4 flottes visibles · 3 commandants')).toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons[0]).toHaveAccessibleName('Inspecter Vous (#1) : 1 flotte');
        expect(screen.getByRole('button', {name: 'Inspecter Commandant 7 (#7) : 2 flottes'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Inspecter Commandant 12 (#12) : 1 flotte'})).toBeInTheDocument();
    });

    it('keeps filtered fleets inspectable and explains visible versus report totals', () => {
        const summary = buildFleetCells(fleets, ['massive', 'unknown']).get('19_6')!;
        render(<FleetRoster {...props} summary={summary} />);
        expect(screen.getByText('1/4 flottes visibles · 3 commandants')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('3 flottes masquées');
        userEvent.click(screen.getByRole('button', {name: /Inspecter Commandant 7/}));
        const table = screen.getByRole('table', {name: 'Flottes de Commandant 7 (#7)'});
        expect(within(table).getAllByText('Masquée sur la carte')).toHaveLength(2);
        expect(within(table).getByText('grande')).toBeInTheDocument();
        expect(within(table).getByText('moyenne')).toBeInTheDocument();
    });

    it('does not infer enemy AS/AP, ship classes or orders', () => {
        const onOpenFleetPicker = jest.fn();
        render(<FleetRoster {...props} onOpenFleetPicker={onOpenFleetPicker} />);
        userEvent.click(screen.getByRole('button', {name: /Inspecter Commandant 12/}));
        const table = screen.getByRole('table', {name: 'Flottes de Commandant 12 (#12)'});
        expect(within(table).getByText('Inconnue')).toBeInTheDocument();
        expect(within(table).queryByText(/AS /)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Préparer un déplacement/})).not.toBeInTheDocument();
        expect(onOpenFleetPicker).not.toHaveBeenCalled();
    });

    it('reuses the existing own-fleet picker only after an explicit own-fleet action', () => {
        const onOpenFleetPicker = jest.fn();
        render(<FleetRoster {...props} onOpenFleetPicker={onOpenFleetPicker} />);
        userEvent.click(screen.getByRole('button', {name: /Inspecter Vous/}));
        expect(screen.getByText('Vitesse 4 · AS 1200 / AP 100')).toBeInTheDocument();
        userEvent.click(screen.getByRole('button', {name: /Préparer un déplacement/}));
        expect(onOpenFleetPicker).toHaveBeenCalledWith(pos, expect.any(Number), expect.any(Number));
    });

    it('accepts repeated marker inspection requests and provides keyboard focus', () => {
        const {rerender} = render(<FleetRoster {...props} inspection={{pos, owner: 7, focus: true}} />);
        const button = screen.getByRole('button', {name: /Inspecter Commandant 7/});
        expect(button).toHaveFocus();
        expect(button).toHaveAttribute('aria-expanded', 'true');
        userEvent.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'false');
        rerender(<FleetRoster {...props} inspection={{pos, owner: 7, focus: true}} />);
        expect(button).toHaveAttribute('aria-expanded', 'true');
        rerender(<FleetRoster {...props} inspection={{pos, focus: true}} />);
        expect(screen.getByRole('heading', {name: 'Présence de flottes'})).toHaveFocus();
    });

    it('closes the expanded owner with Escape without moving focus to the map', () => {
        render(<FleetRoster {...props} inspection={{pos, owner: 7, focus: true}} />);
        const button = screen.getByRole('button', {name: /Inspecter Commandant 7/});
        fireEvent.keyDown(button, {key: 'Escape'});
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveFocus();
    });

    it('highlights the cell on fleet-row hover and clears it on leave/unmount', () => {
        const onFleetHover = jest.fn();
        const {unmount} = render(<FleetRoster {...props} inspection={{pos, owner: 7}} onFleetHover={onFleetHover} />);
        const table = screen.getByRole('table', {name: 'Flottes de Commandant 7 (#7)'});
        const row = within(table).getAllByRole('row')[1];
        fireEvent.mouseEnter(row);
        expect(onFleetHover).toHaveBeenLastCalledWith(pos);
        fireEvent.mouseLeave(row);
        expect(onFleetHover).toHaveBeenLastCalledWith(undefined);
        unmount();
        expect(onFleetHover).toHaveBeenLastCalledWith(undefined);
    });
});
