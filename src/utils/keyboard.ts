// Vrai si l'événement clavier vient d'un champ de saisie (on ne doit alors pas déclencher de raccourci)
export function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
