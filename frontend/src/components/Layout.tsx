import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";
import type { Lega } from "../api/types";

const RITARDO_CHIUSURA_MS = 200;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [legheAperto, setLegheAperto] = useState(false);
  const [leghe, setLeghe] = useState<Lega[]>([]);
  const [caricamentoLeghe, setCaricamentoLeghe] = useState(false);
  const chiusuraTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apriLeghe() {
    if (chiusuraTimeout.current) {
      clearTimeout(chiusuraTimeout.current);
      chiusuraTimeout.current = null;
    }
    setLegheAperto(true);
    setCaricamentoLeghe(true);
    apiFetch<Lega[]>("/leghe")
      .then(setLeghe)
      .catch(() => setLeghe([]))
      .finally(() => setCaricamentoLeghe(false));
  }

  function chiudiLegheConRitardo() {
    chiusuraTimeout.current = setTimeout(() => setLegheAperto(false), RITARDO_CHIUSURA_MS);
  }

  function chiudiLegheSubito() {
    if (chiusuraTimeout.current) clearTimeout(chiusuraTimeout.current);
    setLegheAperto(false);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const legheAttiva = location.pathname === "/" || location.pathname.startsWith("/leghe/");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⚽</span> Fanta<span className="brand-word">calcio</span>
        </div>
        <nav>
          <div className="nav-dropdown" onMouseEnter={apriLeghe} onMouseLeave={chiudiLegheConRitardo}>
            <button type="button" className={`nav-dropdown-trigger ${legheAttiva ? "active" : ""}`}>
              Le mie leghe <span className="nav-dropdown-caret">{legheAperto ? "▴" : "▾"}</span>
            </button>
            {legheAperto && (
              <div className="nav-dropdown-menu">
                <Link to="/" className="nav-dropdown-item" onClick={chiudiLegheSubito}>
                  Tutte le leghe
                </Link>
                <div className="nav-dropdown-divider" />
                {caricamentoLeghe ? (
                  <span className="nav-dropdown-empty muted">Caricamento...</span>
                ) : leghe.length === 0 ? (
                  <span className="nav-dropdown-empty muted">Non fai parte di nessuna lega</span>
                ) : (
                  leghe.map((l) => (
                    <Link key={l.id} to={`/leghe/${l.id}`} className="nav-dropdown-item" onClick={chiudiLegheSubito}>
                      {l.nome}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
          <NavLink to="/giocatori" className={({ isActive }) => (isActive ? "active" : "")}>
            Giocatori &amp; Live
          </NavLink>
          {user && (
            <span className="muted" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {user.nome}
              <button className="secondary" onClick={handleLogout}>
                Esci
              </button>
            </span>
          )}
        </nav>
      </header>
      <main className="container">
        <div className="page-enter" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
