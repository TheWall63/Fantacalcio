import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import LegaPage from "./pages/LegaPage";
import LegaSetupPage from "./pages/LegaSetupPage";
import MercatoPage from "./pages/MercatoPage";
import SquadraPage from "./pages/SquadraPage";
import GiocatoriPage from "./pages/GiocatoriPage";
import FormazionePage from "./pages/FormazionePage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leghe/:id" element={<LegaPage />} />
        <Route path="/leghe/:id/setup" element={<LegaSetupPage />} />
        <Route path="/leghe/:id/mercato" element={<MercatoPage />} />
        <Route path="/squadre/:id" element={<SquadraPage />} />
        <Route path="/giocatori" element={<GiocatoriPage />} />
        <Route path="/formazione/:squadraId/:giornataId" element={<FormazionePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
