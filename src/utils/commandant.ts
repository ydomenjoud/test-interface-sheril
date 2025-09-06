import {Commandant} from "../types";

export function commandantAsString(global: any, num: number) {
    const commandant = global?.commandants.find((c: Commandant) => c?.numero===num);
    if(commandant) {
        return `${commandant.nom} (${commandant.numero})`;
    } else {
        return 'neutre'
    }
}
