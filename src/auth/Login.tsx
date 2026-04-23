import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!username.trim()) {
      setError('Please enter your username or email');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      // Query Firestore for username OR email
      let q = query(collection(db, 'profiles'), where('email', '==', username.trim()));
      let querySnapshot = await getDocs(q);
      
      // If not found by email, try by username
      if (querySnapshot.empty) {
        q = query(collection(db, 'profiles'), where('username', '==', username.trim()));
        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty) {
        setError('Username/Email not found');
        setLoading(false);
        return;
      }

      const profileData = querySnapshot.docs[0].data();
      const userEmail = profileData.email;

      if (!userEmail) {
        setError('Email not found for this account. Please contact administrator.');
        setLoading(false);
        return;
      }

      // Sign in with email and password
      await signInWithEmailAndPassword(auth, userEmail, password);

      // Store user info in localStorage
      localStorage.setItem('user', JSON.stringify({
        username: profileData.username || username.trim(),
        email: userEmail,
        role: profileData.role || 'user',
        full_name: profileData.full_name || ''
      }));

      navigate('/dashboard', { replace: true });

    } catch (err: any) {
      console.error('Login error:', err);

      // Handle specific Firebase auth errors
      switch (err.code) {
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/user-not-found':
          setError('User not found. Please check your credentials.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email format in database.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;
        default:
          setError(err.message || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">

      {/* Headings aligned perfectly */}
      <div className="text-center space-y-3 mb-10 w-full">
        <h2 className="text-[28px] font-bold tracking-tight text-black font-[var(--heading)]">
          Welcome back
        </h2>
        <p className="text-[13px] text-gray-500 font-[var(--sans)]">
          Sign in to access the Assessor's Office records.
        </p>
      </div>

      {/* Form Fields & Button exactly matching image layout */}
      <form className="w-full space-y-4" onSubmit={handleSubmit}>

        <div className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              {/* User Icon SVG */}
              <svg className="h-[18px] w-[18px] text-gray-400 group-focus-within:text-green-600 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <input
              id="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-11 pr-4 py-[14px] rounded-lg border border-[var(--border)] bg-white text-black text-sm focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all outline-none placeholder-shown:placeholder-gray-400 peer"
              placeholder=" "
            />
            <label
              htmlFor="username"
              className="absolute left-11 top-[14px] text-sm text-gray-400 transition-all duration-200 pointer-events-none peer-focus:top-[-8px] peer-focus:text-green-600 peer-focus:text-xs peer-focus:px-1 peer-focus:bg-white peer-not-placeholder-shown:top-[-8px] peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white peer-not-placeholder-shown:text-green-600 bg-white"
            >
              Username or Email
            </label>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              {/* Lock Icon SVG */}
              <svg className="h-[18px] w-[18px] text-gray-400 group-focus-within:text-green-600 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-12 py-[14px] rounded-lg border border-[var(--border)] bg-white text-black text-sm focus:ring-1 focus:ring-green-600 focus:border-green-600 transition-all outline-none placeholder-shown:placeholder-gray-400 peer"
              placeholder=" "
            />
            <label
              htmlFor="password"
              className="absolute left-11 top-[14px] text-sm text-gray-400 transition-all duration-200 pointer-events-none peer-focus:top-[-8px] peer-focus:text-green-600 peer-focus:text-xs peer-focus:px-1 peer-focus:bg-white peer-not-placeholder-shown:top-[-8px] peer-not-placeholder-shown:text-xs peer-not-placeholder-shown:px-1 peer-not-placeholder-shown:bg-white peer-not-placeholder-shown:text-green-600 bg-white"
            >
              Password
            </label>
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 text-gray-400 hover:text-green-600 transition-colors"
              >
                {showPassword ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
              </button>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="login-btn"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </form>
    </div>
  );
}