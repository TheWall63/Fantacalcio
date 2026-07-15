import { useEffect } from "react";

// Imposta il titolo della scheda del browser per la pagina corrente.
export function useDocumentTitle(titolo: string) {
  useEffect(() => {
    document.title = titolo ? `${titolo} · Fantacalcio` : "Fantacalcio";
  }, [titolo]);
}
