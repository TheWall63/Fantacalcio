import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";
import type { Lega } from "../api/types";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [legheAperto, setLegheAperto] = useState(false);
  const [leghe, setLeghe] = useState<Lega[]>([]);
  const [caricamentoLeghe, setCaricamentoLeghe] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLegheAperto(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickFuori(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLegheAperto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuori);
    return () => document.removeEventListener("mousedown", handleClickFuori);
  }, []);

  async function toggleLeghe() {
    const apriOra = !legheAperto;
    setLegheAperto(apriOra);
    if (apriOra) {
      setCaricamentoLeghe(true);
      try {
        setLeghe(await apiFetch<Lega[]>("/leghe"));
      } catch {
        setLeghe([]);
      } finally {
        setCaricamentoLeghe(false);
      }
    }
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
          ⚽ Fanta<span>calcio</span>
        </div>
        <nav>
          <div className="nav-dropdown" ref={dropdownRef}>
            <button type="button" className={`nav-dropdown-trigger ${legheAttiva ? "active" : ""}`} onClick={toggleLeghe}>
              Le mie leghe <span className="nav-dropdown-caret">{legheAperto ? "▴" : "▾"}</span>
            </button>
            {legheAperto && (
              <div className="nav-dropdown-menu">
                <Link to="/" className="nav-dropdown-item" onClick={() => setLegheAperto(false)}>
                  Tutte le leghe
                </Link>
                <div className="nav-dropdown-divider" />
                {caricamentoLeghe ? (
                  <span className="nav-dropdown-empty muted">Caricamento...</span>
                ) : leghe.length === 0 ? (
                  <span className="nav-dropdown-empty muted">Non fai parte di nessuna lega</span>
                ) : (
                  leghe.map((l) => (
                    <Link key={l.id} to={`/leghe/${l.id}`} className="nav-dropdown-item" onClick={() => setLegheAperto(false)}>
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
