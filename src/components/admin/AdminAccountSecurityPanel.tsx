import React, { useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { KeyRound, Save, UserCog } from 'lucide-react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../../lib/firebase';
import type { AdminUser } from '../../types/umc';

interface AdminAccountSecurityPanelProps {
  user: User;
  currentAdminRecord: AdminUser | undefined;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

const ADMIN_USERNAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

export function AdminAccountSecurityPanel({
  user,
  currentAdminRecord,
  onFeedback,
}: AdminAccountSecurityPanelProps) {
  const [adminUsername, setAdminUsername] = useState(
    currentAdminRecord?.username || ''
  );
  const [displayName, setDisplayName] = useState(
    currentAdminRecord?.displayName || user.displayName || 'UMC Administrator'
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (currentAdminRecord) {
      if (currentAdminRecord.username) setAdminUsername(currentAdminRecord.username);
      if (currentAdminRecord.displayName) setDisplayName(currentAdminRecord.displayName);
    }
  }, [currentAdminRecord]);

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = adminUsername.trim();
    const cleanDisplayName = displayName.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 40 || !ADMIN_USERNAME_REGEX.test(cleanUsername)) {
      onFeedback(
        'error',
        'Administrative username must be 3–40 characters using only letters, numbers, underscores, dots, or hyphens.'
      );
      return;
    }
    if (cleanDisplayName.length < 2 || cleanDisplayName.length > 80) {
      onFeedback('error', 'Display name must be between 2 and 80 characters.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: cleanDisplayName });

      const adminRef = doc(db, 'admins', user.uid);
      const snap = await getDoc(adminRef);
      if (snap.exists()) {
        try {
          await updateDoc(adminRef, {
            username: cleanUsername,
            displayName: cleanDisplayName,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `admins/${user.uid}`);
        }
      } else {
        try {
          await setDoc(adminRef, {
            uid: user.uid,
            email: (user.email || '').toLowerCase(),
            displayName: cleanDisplayName,
            username: cleanUsername,
            addedBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `admins/${user.uid}`);
        }
      }

      onFeedback(
        'success',
        `Administrative username updated to "${cleanUsername}" and display name updated.`
      );
    } catch (err) {
      onFeedback(
        'error',
        err instanceof Error ? err.message : 'Unable to update administrative profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.email) {
      onFeedback('error', 'No email address is associated with this administrator account.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      onFeedback('error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      onFeedback('error', 'New password and confirmation password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      if (hasPasswordProvider) {
        if (!currentPassword) {
          onFeedback('error', 'Please enter your current password to verify your identity.');
          setSavingPassword(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        onFeedback('success', 'Administrator password updated successfully.');
      } else {
        const credential = EmailAuthProvider.credential(user.email, newPassword);
        try {
          await linkWithCredential(user, credential);
        } catch (linkErr: unknown) {
          const code = (linkErr as { code?: string })?.code || '';
          if (code === 'auth/requires-recent-login') {
            await reauthenticateWithPopup(user, googleProvider);
            await linkWithCredential(user, credential);
          } else {
            throw linkErr;
          }
        }
        onFeedback(
          'success',
          'Password credential linked to your administrator account. You can now sign in with Email & Password as well as Google.'
        );
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        onFeedback('error', 'Current password is incorrect.');
      } else if (code === 'auth/weak-password') {
        onFeedback('error', 'Password is too weak. Use at least 8 characters with letters and numbers.');
      } else if (code === 'auth/operation-not-allowed') {
        onFeedback(
          'error',
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Enable Email/Password there first to set or update a password.'
        );
      } else if (code === 'auth/requires-recent-login') {
        onFeedback(
          'error',
          'For security, please log out and sign back in before changing your password.'
        );
      } else {
        onFeedback('error', err instanceof Error ? err.message : 'Unable to update password.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setSavingPassword(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      onFeedback('success', `Password reset link sent to ${user.email}.`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        onFeedback(
          'error',
          'Enable Email/Password sign-in in Firebase Console (Authentication → Sign-in method) to use password reset emails.'
        );
      } else {
        onFeedback('error', err instanceof Error ? err.message : 'Unable to send reset email.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Administrative Username & Display Name */}
      <form
        onSubmit={handleSaveIdentity}
        className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5 h-fit"
      >
        <div className="flex items-center gap-2.5 border-b border-[#1E2530] pb-3">
          <UserCog className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Administrative Username & Profile</h2>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs text-slate-400">Administrator Email (Login ID)</label>
          <input
            type="text"
            disabled
            value={user.email || ''}
            className="w-full px-3.5 py-2.5 text-sm bg-[#090B0E] border border-[#1E2530] rounded-lg text-slate-400"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-username-input" className="block text-sm font-medium text-slate-200">
            Administrative Username *
          </label>
          <input
            id="admin-username-input"
            type="text"
            required
            minLength={3}
            maxLength={40}
            value={adminUsername}
            onChange={(e) => setAdminUsername(e.target.value)}
            placeholder="e.g. umc_head_admin"
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
          />
          <p className="text-xs text-slate-500">
            3–40 characters (letters, numbers, underscores, dots, or hyphens).
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-display-name" className="block text-sm font-medium text-slate-200">
            Display Name *
          </label>
          <input
            id="admin-display-name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="UMC Head Administrator"
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {savingProfile ? 'Saving...' : 'Save Username & Profile'}
        </button>
      </form>

      {/* Administrator Password Management */}
      <form
        onSubmit={handlePasswordChange}
        className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5 h-fit"
      >
        <div className="flex items-center gap-2.5 border-b border-[#1E2530] pb-3">
          <KeyRound className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">
            {hasPasswordProvider ? 'Change Administrator Password' : 'Set Administrator Password'}
          </h2>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {hasPasswordProvider
            ? 'Enter your current password and choose a new password (minimum 8 characters). Passwords are encrypted and managed securely by Firebase Authentication.'
            : 'Your administrator account is currently signed in with Google. You can attach an Email & Password credential here so you can also sign in with your password.'}
        </p>

        {hasPasswordProvider && (
          <div className="space-y-1.5">
            <label htmlFor="admin-curr-pw" className="block text-sm font-medium text-slate-200">
              Current Password *
            </label>
            <input
              id="admin-curr-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="admin-new-pw" className="block text-sm font-medium text-slate-200">
            New Password (min. 8 characters) *
          </label>
          <input
            id="admin-new-pw"
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new strong password"
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="admin-confirm-pw" className="block text-sm font-medium text-slate-200">
            Confirm New Password *
          </label>
          <input
            id="admin-confirm-pw"
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {savingPassword
              ? 'Updating...'
              : hasPasswordProvider
              ? 'Update Password'
              : 'Set Password'}
          </button>

          <button
            type="button"
            disabled={savingPassword}
            onClick={handleSendResetEmail}
            className="text-xs font-medium text-emerald-400 hover:underline"
          >
            Send Password Reset Email Instead
          </button>
        </div>
      </form>
    </div>
  );
}
