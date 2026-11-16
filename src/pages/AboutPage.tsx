import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Shield, Users } from 'lucide-react';
import { ABOUT_CREST_IMAGE } from '../constants/validation';
import { SafeImage } from '../components/SafeImage';

export function AboutPage() {
  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              About UMC
            </p>
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">
              Unofficial Minecraft Community & Championship
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              UMC is an independent competitive Minecraft tournament platform built to give
              Java and Bedrock players an organized, verified, and transparent esports circuit.
            </p>
            <p className="text-base text-slate-400 leading-relaxed">
              Unlike informal server events, every UMC competitor completes an authenticated
              registration workflow. Applications are personally reviewed by platform
              administrators so brackets remain authentic, regional rosters stay accurate,
              and bad-faith duplicate accounts are kept out of competitive play.
            </p>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-[#232B38] bg-[#11151B]">
              <SafeImage
                src={ABOUT_CREST_IMAGE}
                alt="UMC Championship Emblem"
                className="w-full aspect-[4/3] object-cover"
                fallbackTitle="UMC Championship"
              />
            </div>
          </div>
        </div>

        {/* Platform Governance Structure */}
        <div className="border-t border-[#1C222D] pt-14 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-3xl font-display font-bold text-white">
              Two-Tier Governance Model
            </h2>
            <p className="text-sm text-slate-400">
              UMC operates with a direct, streamlined accountability model consisting strictly
              of Players and Administrators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Registered Players</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Competitors register with verified email credentials, regional details, and
                their official Minecraft username. Once approved by an administrator, players
                gain access to tournament entry, team rosters, and match schedules.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Personal Player Dashboard & Status Tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Java Edition & Bedrock Edition Participation</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct Approval & Rejection Status Notifications</span>
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-bold text-white">Platform Administrators</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Authorized administrators oversee player approvals, account integrity,
                tournament brackets, match results, official rulebooks, announcements, and
                site availability controls.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Manual Player Review, Approval, Rejection & Suspension</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>End-to-End Tournament, Team & Match Management</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Database-Enforced Security Rules & Registration Controls</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Approval Workflow */}
        <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-6">
          <h2 className="text-2xl font-display font-bold text-white">
            Player Verification Workflow
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
            {[
              { step: '01', title: 'Player Registration', desc: 'Submit profile, Minecraft IGN, and email.' },
              { step: '02', title: 'Pending Approval', desc: 'Account created securely in review queue.' },
              { step: '03', title: 'Admin Review', desc: 'Administrator verifies player eligibility.' },
              { step: '04', title: 'Approved or Rejected', desc: 'Approved players unlock tournament entry.' },
            ].map((item) => (
              <div key={item.step} className="p-4 rounded-lg bg-[#0D1117] border border-[#1E2530]">
                <span className="font-mono text-xs text-emerald-400 font-semibold">
                  Step {item.step}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{item.title}</h3>
                <p className="text-slate-400 mt-1 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Register as a Player
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/rules"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-200 bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors"
            >
              Read Official Rules
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
