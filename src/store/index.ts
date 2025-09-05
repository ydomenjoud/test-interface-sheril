import { create } from 'zustand';
import { GlobalData, Rapport } from '../models';

interface AppState {
    globalData: GlobalData | null;
    rapport: Rapport | null;
    currentScreen: string;
    setGlobalData: (data: GlobalData) => void;
    setRapport: (rapport: Rapport) => void;
    setCurrentScreen: (screen: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
    globalData: null,
    rapport: null,
    currentScreen: 'carte',
    setGlobalData: (data) => set({ globalData: data }),
    setRapport: (rapport) => set({ rapport }),
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
}));
