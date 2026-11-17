import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UMC_LIMITS, UMC_PATTERNS } from '../constants/validation';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [minecraftUsername, setMinecraftUsername] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMc = minecraftUsername.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanName.length < 2 || cleanName.length > UMC_LIMITS.FULL_NAME_MAX) {
      setError('Name must be between 2 and 80 characters.');
      return;
    }
    if (!UMC_PATTERNS.EMAIL.test(cleanEmail) || cleanEmail.length > UMC_LIMITS.EMAIL_MAX) {
      setError('Please enter a valid email address.');
      return;
    }
    if (cleanMc.length > UMC_LIMITS.MC_USERNAME_MAX) {
      setError('Minecraft username cannot exceed 32 characters.');
      return;
    }
    if (
      cleanSubject.length < UMC_LIMITS.CONTACT_SUBJECT_MIN ||
      cleanSubject.length > UMC_LIMITS.CONTACT_SUBJECT_MAX
    ) {
      setError('Subject must be between 3 and 140 characters.');
      return;
    }
    if (
      cleanMessage.length < UMC_LIMITS.CONTACT_MESSAGE_MIN ||
      cleanMessage.length > UMC_LIMITS.CONTACT_MESSAGE_MAX
    ) {
      setError('Message must be between 10 and 3000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      try {
        const validateRes = await fetch('/api/validate-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            minecraftUsername: cleanMc,
            subject: cleanSubject,
            message: cleanMessage,
          }),
        });
        const contentType = validateRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const validateJson = (await validateRes.json()) as { valid?: boolean; error?: string };
          if (!validateRes.ok || !validateJson?.valid) {
            setError(validateJson?.error || 'Validation failed. Please check your message.');
            setSubmitting(false);
            return;
          }
        }
      } catch {
        // Static/published hosting without Express backend uses client + Firestore rules validation
      }

      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const msgRef = doc(db, 'contactMessages', msgId);
      try {
        await setDoc(msgRef, {
          name: cleanName,
          email: cleanEmail,
          minecraftUsername: cleanMc,
          subject: cleanSubject,
          message: cleanMessage,
          status: 'NEW',
          createdAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `contactMessages/${msgId}`);
      }

      setSubmitted(true);
      setName('');
      setEmail('');
      setMinecraftUsername('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 border-b border-[#1C222D] pb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Mail className="w-4 h-4" />
            <span>Support & Inquiries</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">Contact Us</h1>
          <p className="text-base text-slate-400 max-w-2xl">
            Reach out directly to the UMC Administrator team for registration questions,
            tournament disputes, fair-play reports, or general community support.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-4">
            <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <h2 className="text-xl font-bold text-white">Direct Administration</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                All inquiries submitted here are routed directly to the Administrator Dashboard
                inbox. No intermediaries.
              </p>
              <div className="pt-2 border-t border-[#1E2530] space-y-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Response SLA</div>
                  <div className="text-slate-200 font-medium">24–48 Hours</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Supported Editions</div>
                  <div className="text-slate-200 font-medium">Java & Bedrock Edition</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Account Appeals</div>
                  <div className="text-slate-200 font-medium">Include your UMC Username</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38]">
              {submitted ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-white">
                    Message Received
                  </h2>
                  <p className="text-sm text-slate-300 max-w-md mx-auto">
                    Your inquiry has been logged in the UMC Administrator inbox. Thank you for
                    contacting UMC.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="block text-sm font-medium text-slate-200">
                        Full Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        maxLength={UMC_LIMITS.FULL_NAME_MAX}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="block text-sm font-medium text-slate-200">
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        maxLength={UMC_LIMITS.EMAIL_MAX}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-mc" className="block text-sm font-medium text-slate-200">
                        Minecraft Username (Optional)
                      </label>
                      <input
                        id="contact-mc"
                        type="text"
                        maxLength={UMC_LIMITS.MC_USERNAME_MAX}
                        value={minecraftUsername}
                        onChange={(e) => setMinecraftUsername(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="In-game name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-200">
                        Subject *
                      </label>
                      <input
                        id="contact-subject"
                        type="text"
                        required
                        maxLength={UMC_LIMITS.CONTACT_SUBJECT_MAX}
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="Registration, tournament, or rule inquiry"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="contact-message" className="block text-sm font-medium text-slate-200">
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      required
                      maxLength={UMC_LIMITS.CONTACT_MESSAGE_MAX}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                      placeholder="Describe your question or report clearly..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Sending Message...' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
