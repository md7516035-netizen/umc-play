import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { KeyRound, LogIn } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, playerProfile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (user && playerProfile) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <h1 className="text-2xl font-display font-bold text-white">Already Signed In</h1>
          <p className="text-sm text-slate-300">
            You are signed in as <strong className="text-white">{playerProfile.username}</strong>.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Go to Player Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (user && isAdmin && !playerProfile) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <h1 className="text-2xl font-display font-bold text-white">Administrator Session Active</h1>
          <p className="text-sm text-slate-300">
            You are currently signed in with an Administrator account ({user.email}).
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Open Administrator Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Invalid email address or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not yet enabled in Firebase Console. Contact the UMC administrator.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    if (!email.trim()) {
      setError('Enter your registered email address first.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setInfoMsg(
        'Password reset instructions have been sent if an account matches that email address.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-display font-bold text-white">
            {resetMode ? 'Reset Password' : 'Player Login'}
          </h1>
          <p className="text-sm text-slate-400">
            {resetMode
              ? 'Enter your email address to receive a password reset link.'
              : 'Sign in to check your approval status and enter tournaments.'}
          </p>
        </div>

        <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
              {error}
            </div>
          )}
          {infoMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-sm">
              {infoMsg}
            </div>
          )}

          {resetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-200">
                  Registered Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="player@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setError('');
                  setInfoMsg('');
                }}
                className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back to Player Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-200">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="player@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-200">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      setError('');
                      setInfoMsg('');
                    }}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-[#1E2530] text-center space-y-2 text-sm text-slate-400">
            <p>
              New to UMC?{' '}
              <Link to="/register" className="text-emerald-400 hover:underline font-medium">
                Register as a Player
              </Link>
            </p>
            <p className="text-xs">
              Administrator?{' '}
              <Link to="/admin-login" className="text-slate-300 hover:text-white underline">
                Go to Administrator Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
