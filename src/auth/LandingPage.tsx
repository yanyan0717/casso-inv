import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Login from './Login';
import logoUrl from '../assets/casso.png';
import bgImage from '../assets/casso1.jpg';

export default function LandingPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigate('/dashboard', { replace: true });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    return (
        <div className="flex h-screen w-full bg-white">
            {/* Left Side - Logo and Branding */}
            <div className="relative hidden lg:flex w-1/2 h-full flex-col items-center justify-center bg-gradient-to-br from-[#166534] to-[#14532d]">
                <img 
                    src={bgImage}
                    alt="Background"
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#166534] to-[#14532d] opacity-80"></div>
                <div className="absolute inset-0 bg-black/15 pointer-events-none mix-blend-multiply"></div>

                <div className="relative z-10 flex flex-col items-center text-center px-12">
                    <div className="w-72 h-72 rounded-full overflow-hidden mb-8 drop-shadow-2xl flex items-center justify-center bg-white/10">
                        <img
                            src={logoUrl}
                            alt="City Assessor Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-widest mb-4 uppercase drop-shadow-md">
                        ILIGAN CITY
                    </h1>
                    <p className="text-white/80 tracking-[0.15em] text-[13px] md:text-sm font-semibold uppercase font-[var(--sans)] leading-relaxed">
                        Assessor's Office Digital Inventory System
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="relative w-full lg:w-1/2 h-full flex items-center justify-center bg-white px-6 md:px-12">
                <div className="w-full max-w-[360px]">
                    <Login />

                    {/* Guest Mode */}
                    <div className="mt-5">
                        <div className="relative flex items-center gap-3 mb-4">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest whitespace-nowrap">or</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                        <button
                            onClick={() => navigate('/guest')}
                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-[#166534] hover:border-[#166534] hover:text-white active:bg-[#14532d] active:border-[#14532d] transition-all group cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            Browse as Guest
                        </button>
                        <p className="text-center text-[10px] text-gray-400 mt-2">View-only access · No login required</p>
                    </div>
                </div>

                <div className="absolute bottom-10 inset-x-0 text-center">
                    <p className="text-[10px] tracking-[0.2em] text-[var(--text)]/40 uppercase font-bold">
                        Created for Iligan City Assessor's Office 2026
                    </p>
                </div>
            </div>
        </div>
    );
}
