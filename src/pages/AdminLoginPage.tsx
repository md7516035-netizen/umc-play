import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Lock, ShieldCheck } from 'lucide-react';
import { auth, db, googleProvider } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const BOOTSTRAP_ADMIN_EMAIL = 'md7516035@gmail.com';

export function AdminLoginPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  if (user && isAdmin) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-white">
            Administrator Authenticated
          </h1>
          <p className="text-sm text-slate-300">
            Signed in as <strong className="text-white">{user.email}</strong>.
          </p>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Enter Administrator Dashboard
          </button>
        </div>
      </div>
    );
  }

  const verifyAdminEligibility = async (uid: string, userEmail: string | null, emailVerified: boolean) => {
    const isBootstrap =
      userEmail?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL && emailVerified === true;
    if (isBootstrap) return true;
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    return adminSnap.exists();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const allowed = await verifyAdminEligibility(
        cred.user.uid,
        cred.user.email,
        cred.user.emailVerified
      );
      if (!allowed) {
        await signOut(auth);
        setError('Access denied. This account does not have Administrator permissions.');
        setLoading(false);
        return;
      }
      navigate('/admin');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Invalid administrator email or password.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password login is not enabled in Firebase Console. Sign in with Google below if your Google account is authorized, or enable Email/Password in Firebase Auth.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const allowed = await verifyAdminEligibility(
        cred.user.uid,
        cred.user.email,
        cred.user.emailVerified
      );
      if (!allowed) {
        await signOut(auth);
        setError('Access denied. Your Google account is not registered as an Administrator.');
        setLoading(false);
        return;
      }
      navigate('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setInfoMsg('');
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setError('Enter your administrator email address first to send a password reset link.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setInfoMsg('Password reset instructions have been sent if an account matches that email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Lock className="w-4 h-4" />
            <span>Restricted Access</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-white">Administrator Login</h1>
          <p className="text-sm text-slate-400">
            Authorized UMC Administrators only. Public administrator registration is disabled.
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

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Sign In with Authorized Google Account
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#1E2530]" />
            <span className="shrink mx-3 text-xs text-slate-500">or Email & Password</span>
            <div className="flex-grow border-t border-[#1E2530]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-200">
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-200">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                placeholder="Administrator password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-slate-100 bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In with Email'}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1E2530] text-center text-xs text-slate-500">
            <Link to="/" className="hover:text-slate-300 transition-colors">
              Return to UMC Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
