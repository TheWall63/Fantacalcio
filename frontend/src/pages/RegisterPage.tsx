import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, nome);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="card auth-card">
        <h2>Crea il tuo account</h2>
        <p className="muted">Gestisci la tua lega di fantacalcio con gli amici</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Nome</label>
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password (min. 6 caratteri)</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Creazione..." : "Registrati"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem" }}>
          Hai gia' un account? <Link to="/login">Accedi</Link>
        </p>
      </div>
    </div>
  );
}
