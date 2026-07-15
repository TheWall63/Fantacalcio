import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Le mie leghe
          </NavLink>
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
