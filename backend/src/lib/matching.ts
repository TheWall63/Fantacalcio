// Normalizzazione nomi per matching best-effort tra fonti dati diverse
// (es. "Lautaro Martínez" nel nostro DB vs "Lautaro Martinez" nell'API esterna).
export function normalizzaNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove accenti
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Confronta usando il cognome (ultima parola) come euristica principale,
// dato che le fonti spesso differiscono su nome completo/abbreviazioni.
export function stessoGiocatore(nomeA: string, nomeB: string): boolean {
  const a = normalizzaNome(nomeA);
  const b = normalizzaNome(nomeB);
  if (a === b) return true;
  const cognomeA = a.split(" ").pop();
  const cognomeB = b.split(" ").pop();
  return !!cognomeA && cognomeA.length > 2 && cognomeA === cognomeB;
}
