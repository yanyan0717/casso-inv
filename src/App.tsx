import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './auth/LandingPage';
import Layout from './main/Layout';
import Dashboard from './main/Dashboard';
import Materials from './main/Materials';
import Logs from './main/Logs';
import AddUser from './main/AddUsers';
import Settings from './main/Settings';
import RequestForm from './main/RequestForm';
import OrdersList from './main/OrdersList';
import GuestPage from './guest/GuestPage';
import { ToastContainer } from './components/Toast';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/guest" element={<GuestPage />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/logs" element={<Logs />} />
          <Route path="/add-user" element={<AddUser />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/orders" element={<OrdersList />} />
        </Route>
        
        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

