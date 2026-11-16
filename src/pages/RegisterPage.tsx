import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Lock, UserPlus } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { normalizeMcKey, UMC_LIMITS, UMC_PATTERNS } from '../constants/validation';
import type { MinecraftEdition } from '../types/umc';

export function RegisterPage() {
  const { siteConfig } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [country, setCountry] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [minecraftUsername, setMinecraftUsername] = useState('');
  const [minecraftEdition, setMinecraftEdition] = useState<MinecraftEdition>('JAVA');
  const [age, setAge] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [agreeRules, setAgreeRules] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!siteConfig.registrationOpen) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 sm:py-24 px-4">
        <div className="max-w-xl mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">
            Player Registration is Currently Closed.
          </h1>
          {siteConfig.registrationClosedMessage &&
            siteConfig.registrationClosedMessage !== 'Player Registration is Currently Closed.' && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {siteConfig.registrationClosedMessage}
              </p>
            )}
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Existing Player Login
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim();
    const cleanUsernameLower = cleanUsername.toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCountry = country.trim();
    const cleanState = stateRegion.trim();
    const cleanDistrict = district.trim();
    const cleanMc = minecraftUsername.trim();
    const cleanMcKey = normalizeMcKey(cleanMc);
    const parsedAge = Number(age);
    const cleanContact = contactDetails.trim();

    if (cleanFullName.length < UMC_LIMITS.FULL_NAME_MIN || cleanFullName.length > UMC_LIMITS.FULL_NAME_MAX) {
      setError('Full name must be between 2 and 80 characters.');
      return;
    }
    if (!UMC_PATTERNS.USERNAME.test(cleanUsername)) {
      setError('Username must be 3–30 characters (letters, numbers, and underscores only).');
      return;
    }
    if (!UMC_PATTERNS.EMAIL.test(cleanEmail) || cleanEmail.length > UMC_LIMITS.EMAIL_MAX) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (
      cleanCountry.length < UMC_LIMITS.REGION_MIN ||
      cleanState.length < UMC_LIMITS.REGION_MIN ||
      cleanDistrict.length < UMC_LIMITS.REGION_MIN
    ) {
      setError('Country, State, and District are required (minimum 2 characters each).');
      return;
    }
    if (!UMC_PATTERNS.MC_USERNAME.test(cleanMc) || cleanMcKey.length < 3) {
      setError('Please enter a valid Minecraft username (3–32 characters).');
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < UMC_LIMITS.AGE_MIN || parsedAge > UMC_LIMITS.AGE_MAX) {
      setError(`Age must be a whole number between ${UMC_LIMITS.AGE_MIN} and ${UMC_LIMITS.AGE_MAX}.`);
      return;
    }
    if (cleanContact.length < UMC_LIMITS.CONTACT_MIN || cleanContact.length > UMC_LIMITS.CONTACT_MAX) {
      setError('Contact details must be between 3 and 120 characters.');
      return;
    }
    if (!agreeRules) {
      setError('You must agree to the UMC Rules and Regulations to register.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Backend input validation & live registration gate check
      const valRes = await fetch('/api/validate-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanFullName,
          username: cleanUsername,
          email: cleanEmail,
          password,
          confirmPassword,
          country: cleanCountry,
          state: cleanState,
          district: cleanDistrict,
          minecraftUsername: cleanMc,
          minecraftEdition,
          age: parsedAge,
          contactDetails: cleanContact,
        }),
      });
      const valJson = (await valRes.json()) as { valid: boolean; error?: string };
      if (!valRes.ok || !valJson.valid) {
        setError(valJson.error || 'Registration validation failed.');
        setSubmitting(false);
        return;
      }

      // 2. Check username and Minecraft username uniqueness before creating Auth user
      const usernameDocRef = doc(db, 'usernames', cleanUsernameLower);
      const mcDocRef = doc(db, 'mcUsernames', cleanMcKey);
      const [uSnap, mcSnap] = await Promise.all([getDoc(usernameDocRef), getDoc(mcDocRef)]);

      if (uSnap.exists()) {
        setError('That UMC username is already taken. Please choose a different username.');
        setSubmitting(false);
        return;
      }
      if (mcSnap.exists()) {
        setError('An account is already registered with that Minecraft username.');
        setSubmitting(false);
        return;
      }

      // 3. Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanFullName });

      // 4. Send email verification (non-blocking if SMTP throttled)
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // User can also resend from dashboard
      }

      // 5. Atomically reserve username, Minecraft username, and create PENDING_APPROVAL player record
      const batch = writeBatch(db);
      const playerRef = doc(db, 'players', cred.user.uid);

      batch.set(usernameDocRef, {
        uid: cred.user.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(mcDocRef, {
        uid: cred.user.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(playerRef, {
        uid: cred.user.uid,
        fullName: cleanFullName,
        username: cleanUsername,
        usernameLower: cleanUsernameLower,
        email: cleanEmail,
        country: cleanCountry,
        state: cleanState,
        district: cleanDistrict,
        minecraftUsername: cleanMc,
        minecraftUsernameLower: cleanMcKey,
        minecraftEdition,
        age: parsedAge,
        contactDetails: cleanContact,
        role: 'PLAYER',
        registrationStatus: 'PENDING_APPROVAL',
        accountStatus: 'ACTIVE',
        statusReason: '',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (fsErr) {
        // Clean up Auth user if Firestore batch failed (e.g. race condition duplicate)
        try {
          await cred.user.delete();
        } catch {
          // Ignore cleanup error
        }
        handleFirestoreError(fsErr, OperationType.WRITE, `players/${cred.user.uid}`);
      }

      navigate('/dashboard');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 8 characters with letters and numbers.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password sign-in is not yet enabled in Firebase Console. An administrator must enable the Email/Password provider in Firebase Authentication.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unable to complete registration.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#090B0E] text-slate-100 py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2 border-b border-[#1C222D] pb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <UserPlus className="w-4 h-4" />
            <span>Competitor Onboarding</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-white">Player Registration</h1>
          <p className="text-sm text-slate-400">
            All registrations receive <strong className="text-amber-300">Pending Approval</strong>{' '}
            status and must be reviewed by a UMC Administrator before entering tournaments.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-6"
        >
          {error && (
            <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Personal & Account Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-[#1E2530] pb-2">
              01. Account Credentials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-fullname" className="block text-sm font-medium text-slate-200">
                  Full Name *
                </label>
                <input
                  id="reg-fullname"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.FULL_NAME_MAX}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Enter your legal name"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-username" className="block text-sm font-medium text-slate-200">
                  UMC Username *
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.USERNAME_MAX}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="letters_numbers_only"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-200">
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  maxLength={UMC_LIMITS.EMAIL_MAX}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="player@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-age" className="block text-sm font-medium text-slate-200">
                  Age (13+) *
                </label>
                <input
                  id="reg-age"
                  type="number"
                  required
                  min={UMC_LIMITS.AGE_MIN}
                  max={UMC_LIMITS.AGE_MAX}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                  placeholder="18"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-200">
                  Password (min. 8 characters) *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Create a strong password"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-200">
                  Confirm Password *
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Re-enter password"
                />
              </div>
            </div>
          </div>

          {/* Minecraft & Contact */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-[#1E2530] pb-2">
              02. Minecraft Profile & Contact
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-mc" className="block text-sm font-medium text-slate-200">
                  Minecraft Username *
                </label>
                <input
                  id="reg-mc"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.MC_USERNAME_MAX}
                  value={minecraftUsername}
                  onChange={(e) => setMinecraftUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Exact Java IGN or Bedrock Gamertag"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-edition" className="block text-sm font-medium text-slate-200">
                  Minecraft Edition *
                </label>
                <select
                  id="reg-edition"
                  value={minecraftEdition}
                  onChange={(e) => setMinecraftEdition(e.target.value as MinecraftEdition)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="JAVA">Java Edition</option>
                  <option value="BEDROCK">Bedrock Edition</option>
                  <option value="BOTH">Both (Java & Bedrock)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-contact" className="block text-sm font-medium text-slate-200">
                Contact Details (Phone / Discord Handle) *
              </label>
              <input
                id="reg-contact"
                type="text"
                required
                maxLength={UMC_LIMITS.CONTACT_MAX}
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. +1 555-0199 or Discord: player#0001"
              />
            </div>
          </div>

          {/* Region Details */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white border-b border-[#1E2530] pb-2">
              03. Region Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="reg-country" className="block text-sm font-medium text-slate-200">
                  Country *
                </label>
                <input
                  id="reg-country"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.REGION_MAX}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="Country"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-state" className="block text-sm font-medium text-slate-200">
                  State / Province *
                </label>
                <input
                  id="reg-state"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.REGION_MAX}
                  value={stateRegion}
                  onChange={(e) => setStateRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="State"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-district" className="block text-sm font-medium text-slate-200">
                  District / City *
                </label>
                <input
                  id="reg-district"
                  type="text"
                  required
                  maxLength={UMC_LIMITS.REGION_MAX}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  placeholder="District"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeRules}
                onChange={(e) => setAgreeRules(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[#2A3444] bg-[#0B0E12] text-emerald-500 focus:ring-emerald-500"
              />
              <span>
                I confirm my details are accurate and agree to abide by the official{' '}
                <Link to="/rules" className="text-emerald-400 hover:underline">
                  UMC Rules and Regulations
                </Link>
                .
              </span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting Registration...' : 'Submit Player Registration'}
              </button>
              <p className="text-sm text-slate-400">
                Already registered?{' '}
                <Link to="/login" className="text-emerald-400 hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
