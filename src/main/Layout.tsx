import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Sidebar from '../sidebar/Sidebar';

export default function Layout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/', { replace: true });
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden font-[var(--sans)]">
      <Sidebar />
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-y-auto w-full">
        {/* Main Header / Topbar (optional, but good for design) */}
        <header className="bg-white border-b border-gray-200 h-[72px] flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm shrink-0">
          <h1 className="text-lg font-bold text-gray-800 font-[var(--heading)]">CASSO Inventory System</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-x-hidden">
          <div className="w-full max-w-[1400px] mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
