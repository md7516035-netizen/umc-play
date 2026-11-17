import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { normalizeMcKey, UMC_LIMITS, UMC_PATTERNS } from '../constants/validation';
import type { MinecraftEdition } from '../types/umc';

function mapRegistrationError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email address already exists. Sign in on the Player Login page instead.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Use at least 8 characters with letters and numbers.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Console. An administrator must enable the Email/Password provider in Firebase Authentication.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many registration attempts right now. Please wait a moment and try again.';
  }

  if (err instanceof Error) {
    const raw = err.message.trim();
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        const inner = (parsed.error || '').toLowerCase();
        if (inner.includes('permission') || inner.includes('insufficient')) {
          return 'Registration could not be saved. Registration may have just closed, your chosen username or Minecraft IGN was just claimed, or a field was rejected. Please review your details and try again.';
        }
      } catch {
        // Fall through to generic message
      }
      return 'Unable to save your player profile right now. Please verify your details and try again.';
    }
    return raw;
  }

  return 'Unable to complete registration.';
}

export function RegisterPage() {
  const { user, playerProfile, isAdmin, authReady, siteConfig, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const isCompletingExistingAuth = Boolean(authReady && user && !playerProfile && !isAdmin);

  useEffect(() => {
    if (isCompletingExistingAuth && user?.email) {
      setEmail(user.email);
    }
  }, [isCompletingExistingAuth, user?.email]);

  if (!authReady) {
    return (
      <div className="bg-[#090B0E] text-slate-300 py-24 text-center text-sm">
        Checking registration availability...
      </div>
    );
  }

  if (user && playerProfile) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 sm:py-24 px-4">
        <div className="max-w-xl mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">
            Already Registered &amp; Signed In
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            You are currently signed in as{' '}
            <strong className="text-white">@{playerProfile.username}</strong> (
            {playerProfile.registrationStatus.replace('_', ' ')}). Manage your profile or check
            approval status from your Player Dashboard.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Go to Player Dashboard
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
              }}
              className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors"
            >
              Sign Out to Register Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && isAdmin && !playerProfile) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 sm:py-24 px-4">
        <div className="max-w-xl mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">
            Administrator Session Active
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            You are signed in as an Administrator ({user.email}). Sign out first if you want to
            register a separate player account.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/admin"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Open Administrator Dashboard
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
              }}
              className="px-5 py-2.5 text-sm font-medium text-slate-300 bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    const cleanEmail = (
      isCompletingExistingAuth && user?.email ? user.email : email
    )
      .trim()
      .toLowerCase();
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
    if (!isCompletingExistingAuth) {
      if (password.length < 8 || password.length > 128) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    if (
      cleanCountry.length < UMC_LIMITS.REGION_MIN ||
      cleanCountry.length > UMC_LIMITS.REGION_MAX ||
      cleanState.length < UMC_LIMITS.REGION_MIN ||
      cleanState.length > UMC_LIMITS.REGION_MAX ||
      cleanDistrict.length < UMC_LIMITS.REGION_MIN ||
      cleanDistrict.length > UMC_LIMITS.REGION_MAX
    ) {
      setError('Country, State, and District must each be between 2 and 60 characters.');
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
      // 1. Backend validation when Express API is mounted; fall back to live Firestore check on published static hosting
      let verifiedByApi = false;
      try {
        const valRes = await fetch('/api/validate-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            existingAuthAccount: isCompletingExistingAuth,
            fullName: cleanFullName,
            username: cleanUsername,
            email: cleanEmail,
            password: isCompletingExistingAuth ? '' : password,
            confirmPassword: isCompletingExistingAuth ? '' : confirmPassword,
            country: cleanCountry,
            state: cleanState,
            district: cleanDistrict,
            minecraftUsername: cleanMc,
            minecraftEdition,
            age: parsedAge,
            contactDetails: cleanContact,
          }),
        });
        const contentType = valRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const valJson = (await valRes.json()) as { valid?: boolean; error?: string };
          if (!valRes.ok || !valJson?.valid) {
            setError(valJson?.error || 'Registration validation failed.');
            setSubmitting(false);
            return;
          }
          verifiedByApi = true;
        }
      } catch {
        // Published static hosting without Express backend falls back to direct Firestore check below
      }

      if (!verifiedByApi) {
        try {
          const cfgSnap = await getDoc(doc(db, 'siteConfig', 'global'));
          if (cfgSnap.exists()) {
            const cfg = cfgSnap.data() as {
              registrationOpen?: boolean;
              registrationClosedMessage?: string;
            };
            if (cfg.registrationOpen === false) {
              setError(
                cfg.registrationClosedMessage || 'Player Registration is Currently Closed.'
              );
              setSubmitting(false);
              return;
            }
          }
        } catch {
          // Firestore security rules also enforce registrationOpen on write
        }
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

      // 3. Create or reuse Firebase Auth account
      let targetUser: User;
      let createdNewAuthUser = false;

      if (isCompletingExistingAuth && user) {
        targetUser = user;
      } else {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        targetUser = cred.user;
        createdNewAuthUser = true;
      }

      // 4. Atomically reserve username, Minecraft username, and create PENDING_APPROVAL player record
      // Commit Firestore batch before non-blocking profile/verification updates to avoid AuthContext snapshot race.
      const batch = writeBatch(db);
      const playerRef = doc(db, 'players', targetUser.uid);

      batch.set(usernameDocRef, {
        uid: targetUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(mcDocRef, {
        uid: targetUser.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(playerRef, {
        uid: targetUser.uid,
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
        // Clean up newly created Auth user if Firestore batch failed (e.g. race condition duplicate)
        if (createdNewAuthUser) {
          try {
            await targetUser.delete();
          } catch {
            // Ignore cleanup error
          }
        }
        handleFirestoreError(fsErr, OperationType.WRITE, `players/${targetUser.uid}`);
      }

      // 5. Update Auth displayName and dispatch verification email non-blocking
      try {
        await updateProfile(targetUser, { displayName: cleanFullName });
      } catch {
        // Non-blocking
      }
      if (!targetUser.emailVerified) {
        void sendEmailVerification(targetUser).catch(() => {
          // User can also resend from dashboard
        });
      }

      navigate('/dashboard');
    } catch (err: unknown) {
      setError(mapRegistrationError(err));
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
          <h1 className="text-4xl font-display font-bold text-white">
            {isCompletingExistingAuth ? 'Complete Player Registration' : 'Player Registration'}
          </h1>
          <p className="text-sm text-slate-400">
            All registrations receive <strong className="text-amber-300">Pending Approval</strong>{' '}
            status and must be reviewed by a UMC Administrator before entering tournaments.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-6"
        >
          {isCompletingExistingAuth && (
            <div className="p-4 rounded-lg bg-amber-950/35 border border-amber-500/35 text-amber-100 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>
                You are signed in as <strong className="text-white">{user?.email}</strong> without an
                active player profile. Complete your details below to register for review.
              </span>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#181E27] hover:bg-[#222A37] border border-[#2C374A] rounded-lg whitespace-nowrap shrink-0"
              >
                Use Different Email
              </button>
            </div>
          )}

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
                  autoComplete="name"
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
                  autoComplete="username"
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
                  autoComplete="email"
                  readOnly={isCompletingExistingAuth && Boolean(user?.email)}
                  maxLength={UMC_LIMITS.EMAIL_MAX}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none ${
                    isCompletingExistingAuth && user?.email
                      ? 'bg-[#131820] border-[#263040] text-slate-400 cursor-not-allowed'
                      : 'bg-[#0B0E12] border-[#263040] text-slate-100 focus:border-emerald-500'
                  }`}
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
                  step={1}
                  min={UMC_LIMITS.AGE_MIN}
                  max={UMC_LIMITS.AGE_MAX}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                  placeholder="18"
                />
              </div>
            </div>

            {!isCompletingExistingAuth && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="block text-sm font-medium text-slate-200">
                    Password (min. 8 characters) *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-200">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                      placeholder="Re-enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
