import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          ⚽ Fanta<span>calcio</span>
        </div>
        <nav>
          <NavLink to="/">Le mie leghe</NavLink>
          <NavLink to="/giocatori">Giocatori &amp; Live</NavLink>
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
        <Outlet />
      </main>
    </div>
  );
}
