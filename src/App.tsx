import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './auth/LandingPage';
import Layout from './main/Layout';
import Dashboard from './main/Dashboard';
import Materials from './main/Materials';
import Logs from './main/Logs';
import StorageControl from './main/StorageControl';
import AddUser from './main/AddUsers';
import Settings from './main/Settings';
import RequestForm from './main/RequestForm';
import RequestsList from './main/RequestsList';
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
          <Route path="/materials/requests-list" element={<RequestsList showPendingOnly />} />
          <Route path="/materials/logs" element={<Navigate to="/storage-control/logs" replace />} />
          <Route path="/storage-control" element={<StorageControl />} />
          <Route path="/storage-control/requests-history" element={<RequestsList showHistoryOnly />} />
          <Route path="/storage-control/logs" element={<Logs />} />
          <Route path="/add-user" element={<AddUser />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/orders" element={<Navigate to="/storage-control/requests-history" replace />} />
        </Route>
        
        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

