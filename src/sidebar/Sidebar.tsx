import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, Package, UserPlus, Settings, LogOut, ChevronDown, ClipboardList, Send, X } from 'lucide-react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import logoUrl from '../assets/casso.png';

interface Profile {
  full_name: string | null;
  profile_picture_path: string | null;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRole = async (user: User | null) => {
      if (!user) {
        setRole(null);
        setRoleLoaded(true);
        return;
      }

      const userId = user.uid;
      console.log('Loading profile for userId:', userId);

      try {
        const docRef = doc(db, 'profiles', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawRole = (data?.role || 'user').toLowerCase().trim();
          const normalizedRole = (rawRole === 'admin' || rawRole === 'administrator') ? 'admin' : 'user';

          setRole(normalizedRole);
          setProfile({ full_name: data?.full_name, profile_picture_path: data?.profile_picture_path });
          console.log('Role loaded:', rawRole, '-> normalized to:', normalizedRole);
        } else {
          setRole('user');
          setProfile(null);
          console.log('Profile not found, defaulting to user.');
        }
      } catch (error) {
        setRole('user');
        setProfile(null);
        console.log('Profile error, defaulting to user. Error:', error);
      }

      setRoleLoaded(true);
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      loadRole(user);
    });

    const onRoleRefresh = () => loadRole(auth.currentUser);
    window.addEventListener('casso:refresh-role', onRoleRefresh);

    return () => {
      window.removeEventListener('casso:refresh-role', onRoleRefresh);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { 
      name: 'Materials', 
      path: '/materials', 
      icon: Package,
      subItems: [
        { name: 'Overview', path: '/materials' },
        ...(roleLoaded && role === 'admin' ? [{ name: 'Requests List', path: '/materials/requests-list' }] : []),
      ]
    },
    {
      name: 'Storage Control',
      path: '/storage-control',
      icon: ClipboardList,
      subItems: [
        ...(roleLoaded && role === 'admin' ? [{ name: 'Requests History', path: '/storage-control/requests-history' }] : []),
        { name: 'Material Logs', path: '/storage-control/logs' },
      ]
    },
    ...(roleLoaded && role === 'admin' ? [
      { name: 'Add User', path: '/add-user', icon: UserPlus }
    ] : []),
    ...(roleLoaded && role === 'user' ? [
      { name: 'Request Form', path: '/request', icon: Send }
    ] : []),
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await firebaseSignOut(auth);
    navigate('/');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`w-64 bg-gradient-to-b from-[#166534] to-[#14532d] text-white flex flex-col h-screen fixed top-0 left-0 shadow-2xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0`}>
        {/* Mobile Close Button */}
        <div className="md:hidden p-4 flex justify-end">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Sidebar Header & Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-white/10 shadow-lg">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0 ring-2 ring-white/20">
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black tracking-wider uppercase font-[var(--heading)] truncate">Inventory</h2>
            <p className="text-[10px] text-white/60 uppercase tracking-widest font-[var(--sans)] truncate">Casso System</p>
          </div>
        </div>

      {/* Sidebar Navigation items */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.subItems) {
            const isOpen = expandedGroup === item.name;
            return (
              <div key={item.name} className="flex flex-col space-y-1">
                <button
                  onClick={() => setExpandedGroup(isOpen ? null : item.name)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group text-white/70 hover:bg-white/10 hover:text-white cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 text-white/70 group-hover:text-white" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                  <div className="ml-4 pl-4 border-l border-white/10 flex flex-col space-y-1 animate-in slide-in-from-top-2 duration-300">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        end={sub.path === '/materials' || sub.path === '/storage-control/requests-history' || sub.path === '/storage-control/logs'}
                        onClick={() => window.innerWidth < 768 && onClose()}
                        className={({ isActive }) =>
                          `px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${isActive
                            ? 'bg-white/10 text-white'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                          }`
                        }
                      >
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => window.innerWidth < 768 && onClose()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                  ? 'bg-white/20 text-white shadow-lg ring-1 ring-white/10'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-white/70'
                      }`}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer / User Dropdown */}
      <div className="p-4 border-t border-white/10" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/30 flex items-center justify-center">
                {profile?.profile_picture_path ? (
                  <img src={profile.profile_picture_path} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-white">
                    {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <span className="truncate text-left">{profile?.full_name || 'User'}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a3a2a] rounded-lg shadow-lg border border-white/10 overflow-hidden">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-[#166534] hover:text-white transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
