/**
 * src/types/combat.ts
 * Core types for the Tactical Combat UI
 */

export interface WeaponShot {
    weaponName: string;
    outcome: 'hit' | 'miss' | 'shielded' | 'destroyed' | 'exit';
    damage: number;
    targetPart: 'hull' | 'shield' | 'none';
    isFatal: boolean;
}

export interface FleetExchange {
    attacker: {
        id: string;
        type: string;
        race: number;
        cmd?: string; // Add this line. The '?' makes it optional if some logs don't have it.
        pos: { x: number; y: number; z: number };
    };
    target: {
        instanceId: string;
        type: string;
        pos: { x: number; y: number; z: number };
    };
    distance: number;
    shots: WeaponShot[];
}

export interface TurnState {
    turnNumber: number;
    exchanges: FleetExchange[];
    // Snapshot of fleet health at the end of the turn if available
    summary?: string; 
}

export interface CombatLogData {
    id: string; // Typically the filename
    battleName: string; // Extracted from "RESOLUTION COMBAT [Name]"
    turns: TurnState[];
    
    // Phase 1 Aggregation: Used to render the Strategic Heatmap immediately
    globalMatrix: {
        allShipTypes: string[]; // Sorted list of all unique ship designs involved
        // Key is "AttackerType|TargetType"
        data: Record<string, { 
            dealt: number; 
            received: number; 
            kills: number; 
        }>;
    };
}
