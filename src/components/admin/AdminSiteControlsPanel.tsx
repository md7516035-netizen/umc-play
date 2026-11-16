import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Save, ShieldCheck, UserPlus, Wrench } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import type { SiteConfig, SiteRules } from '../../types/umc';

interface AdminSiteControlsPanelProps {
  siteConfig: SiteConfig;
  siteRules: SiteRules;
  adminUid: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminSiteControlsPanel({
  siteConfig,
  siteRules,
  adminUid,
  onFeedback,
}: AdminSiteControlsPanelProps) {
  const [regOpen, setRegOpen] = useState(siteConfig.registrationOpen);
  const [regClosedMsg, setRegClosedMsg] = useState(siteConfig.registrationClosedMessage);
  const [maintEnabled, setMaintEnabled] = useState(siteConfig.maintenanceEnabled);
  const [maintMsg, setMaintMsg] = useState(siteConfig.maintenanceMessage);
  const [maintAnnouncement, setMaintAnnouncement] = useState(siteConfig.maintenanceAnnouncement);

  const [playerRules, setPlayerRules] = useState(siteRules.playerRules);
  const [tournamentRules, setTournamentRules] = useState(siteRules.tournamentRules);
  const [participationRequirements, setParticipationRequirements] = useState(
    siteRules.participationRequirements
  );
  const [disqualificationRules, setDisqualificationRules] = useState(
    siteRules.disqualificationRules
  );
  const [fairPlayPolicy, setFairPlayPolicy] = useState(siteRules.fairPlayPolicy);

  const [savingConfig, setSavingConfig] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    setRegOpen(siteConfig.registrationOpen);
    setRegClosedMsg(siteConfig.registrationClosedMessage);
    setMaintEnabled(siteConfig.maintenanceEnabled);
    setMaintMsg(siteConfig.maintenanceMessage);
    setMaintAnnouncement(siteConfig.maintenanceAnnouncement);
  }, [siteConfig]);

  useEffect(() => {
    setPlayerRules(siteRules.playerRules);
    setTournamentRules(siteRules.tournamentRules);
    setParticipationRequirements(siteRules.participationRequirements);
    setDisqualificationRules(siteRules.disqualificationRules);
    setFairPlayPolicy(siteRules.fairPlayPolicy);
  }, [siteRules]);

  const persistSiteConfig = async (next: {
    registrationOpen: boolean;
    registrationClosedMessage: string;
    maintenanceEnabled: boolean;
    maintenanceMessage: string;
    maintenanceAnnouncement: string;
  }) => {
    setSavingConfig(true);
    try {
      const ref = doc(db, 'siteConfig', 'global');
      try {
        await setDoc(ref, {
          ...next,
          updatedBy: adminUid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'siteConfig/global');
      }

      // Immediately refresh Express HTTP 503 cache
      await fetch('/api/site-status/refresh', { method: 'POST' });
      onFeedback('success', 'Site registration and availability settings saved.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to save site settings.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      const ref = doc(db, 'siteRules', 'current');
      try {
        await setDoc(ref, {
          playerRules: playerRules.trim(),
          tournamentRules: tournamentRules.trim(),
          participationRequirements: participationRequirements.trim(),
          disqualificationRules: disqualificationRules.trim(),
          fairPlayPolicy: fairPlayPolicy.trim(),
          updatedBy: adminUid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'siteRules/current');
      }
      onFeedback('success', 'Official Rules and Regulations updated.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to update rules.');
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Registration & Maintenance Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Management */}
        <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Registration Controls</h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                regOpen ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {regOpen ? 'Registration ON' : 'Registration OFF'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => {
                setRegOpen(true);
                persistSiteConfig({
                  registrationOpen: true,
                  registrationClosedMessage: regClosedMsg.trim(),
                  maintenanceEnabled: maintEnabled,
                  maintenanceMessage: maintMsg.trim(),
                  maintenanceAnnouncement: maintAnnouncement.trim(),
                });
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                regOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#181E27] text-slate-300 border border-[#2A3444] hover:text-white'
              }`}
            >
              Open Registration (ON)
            </button>
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => {
                setRegOpen(false);
                persistSiteConfig({
                  registrationOpen: false,
                  registrationClosedMessage:
                    regClosedMsg.trim() || 'Player Registration is Currently Closed.',
                  maintenanceEnabled: maintEnabled,
                  maintenanceMessage: maintMsg.trim(),
                  maintenanceAnnouncement: maintAnnouncement.trim(),
                });
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                !regOpen
                  ? 'bg-red-600 text-white'
                  : 'bg-[#181E27] text-slate-300 border border-[#2A3444] hover:text-white'
              }`}
            >
              Close Registration (OFF)
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-closed-msg" className="block text-sm font-medium text-slate-200">
              Registration Closing Message
            </label>
            <textarea
              id="reg-closed-msg"
              rows={3}
              maxLength={500}
              value={regClosedMsg}
              onChange={(e) => setRegClosedMsg(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={savingConfig}
            onClick={() =>
              persistSiteConfig({
                registrationOpen: regOpen,
                registrationClosedMessage:
                  regClosedMsg.trim() || 'Player Registration is Currently Closed.',
                maintenanceEnabled: maintEnabled,
                maintenanceMessage: maintMsg.trim(),
                maintenanceAnnouncement: maintAnnouncement.trim(),
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
          >
            <Save className="w-4 h-4" />
            Save Registration Message
          </button>
        </div>

        {/* Website Maintenance Mode */}
        <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Website Maintenance Mode</h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                maintEnabled ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {maintEnabled ? 'Maintenance ON (HTTP 503)' : 'Website Available (HTTP 200)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => {
                setMaintEnabled(true);
                persistSiteConfig({
                  registrationOpen: regOpen,
                  registrationClosedMessage: regClosedMsg.trim(),
                  maintenanceEnabled: true,
                  maintenanceMessage: maintMsg.trim(),
                  maintenanceAnnouncement: maintAnnouncement.trim(),
                });
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                maintEnabled
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#181E27] text-slate-300 border border-[#2A3444] hover:text-white'
              }`}
            >
              Enable Maintenance (ON)
            </button>
            <button
              type="button"
              disabled={savingConfig}
              onClick={() => {
                setMaintEnabled(false);
                persistSiteConfig({
                  registrationOpen: regOpen,
                  registrationClosedMessage: regClosedMsg.trim(),
                  maintenanceEnabled: false,
                  maintenanceMessage: maintMsg.trim(),
                  maintenanceAnnouncement: maintAnnouncement.trim(),
                });
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                !maintEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#181E27] text-slate-300 border border-[#2A3444] hover:text-white'
              }`}
            >
              Disable Maintenance (OFF)
            </button>
            <Link
              to="/maintenance"
              className="text-xs text-slate-400 hover:text-white underline ml-auto"
            >
              Preview Maintenance Page
            </Link>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="maint-msg" className="block text-sm font-medium text-slate-200">
              Custom Maintenance Message
            </label>
            <textarea
              id="maint-msg"
              rows={2}
              maxLength={500}
              value={maintMsg}
              onChange={(e) => setMaintMsg(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="maint-ann" className="block text-sm font-medium text-slate-200">
              Maintenance Announcement
            </label>
            <textarea
              id="maint-ann"
              rows={2}
              maxLength={500}
              value={maintAnnouncement}
              onChange={(e) => setMaintAnnouncement(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={savingConfig}
            onClick={() =>
              persistSiteConfig({
                registrationOpen: regOpen,
                registrationClosedMessage: regClosedMsg.trim(),
                maintenanceEnabled: maintEnabled,
                maintenanceMessage: maintMsg.trim(),
                maintenanceAnnouncement: maintAnnouncement.trim(),
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
          >
            <Save className="w-4 h-4" />
            Save Maintenance Settings
          </button>
        </div>
      </div>

      {/* Rules & Regulations Editor */}
      <form
        onSubmit={handleSaveRules}
        className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5"
      >
        <div className="flex items-center gap-2.5 border-b border-[#1E2530] pb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Rules and Regulations Editor</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">Player Rules</label>
            <textarea
              rows={5}
              required
              maxLength={5000}
              value={playerRules}
              onChange={(e) => setPlayerRules(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">Tournament Rules</label>
            <textarea
              rows={5}
              required
              maxLength={5000}
              value={tournamentRules}
              onChange={(e) => setTournamentRules(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">
              Participation Requirements
            </label>
            <textarea
              rows={5}
              required
              maxLength={5000}
              value={participationRequirements}
              onChange={(e) => setParticipationRequirements(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">
              Disqualification Rules
            </label>
            <textarea
              rows={5}
              required
              maxLength={5000}
              value={disqualificationRules}
              onChange={(e) => setDisqualificationRules(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-200">Fair-Play Policy</label>
          <textarea
            rows={4}
            required
            maxLength={5000}
            value={fairPlayPolicy}
            onChange={(e) => setFairPlayPolicy(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={savingRules}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {savingRules ? 'Saving Rules...' : 'Publish Rules Update'}
        </button>
      </form>
    </div>
  );
}
