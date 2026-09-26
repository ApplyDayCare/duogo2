import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Shield,
  Lock,
  EyeOff,
  UserCheck,
  Database,
  Trash2,
  Mail,
  CheckCircle2,
  Share2,
  Cookie,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Overview & Pledge" },
  { id: "information-collected", label: "1. Information We Collect" },
  { id: "how-we-use", label: "2. How We Use Your Data" },
  { id: "double-blind", label: "3. Double-Blind Match Privacy" },
  { id: "data-sharing", label: "4. What We Never Do (Zero Ad-Sale)" },
  { id: "third-party", label: "5. Analytics, PostHog & Clarity" },
  { id: "security-retention", label: "6. Security & Storage" },
  { id: "your-rights", label: "7. Your Rights & Account Deletion" },
  { id: "cookies", label: "8. Cookies & Local Storage" },
  { id: "contact", label: "9. Contact Us" },
];

const Privacy = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] font-sans text-[#181513] selection:bg-[#FFD9CE] selection:text-[#FF5436]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#EBE3D5] bg-[#FAF7F2]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full text-xs font-semibold text-[#666059] hover:text-[#181513] hover:bg-[#EFE8DD]/60 gap-1.5 px-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div className="h-4 w-px bg-[#EBE3D5] hidden sm:block" />
          <Link
            to="/"
            className="font-serif text-xl font-bold tracking-tight text-[#181513] hover:opacity-90 flex items-center gap-1"
          >
            <span>duogo</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5436] inline-block" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#888177] bg-white border border-[#EBE3D5] px-2.5 py-1 rounded-full shadow-2xs">
            Updated September 2026
          </span>
          <Link
            to="/terms"
            className="text-xs font-semibold text-[#666059] hover:text-[#181513] px-2.5 py-1 rounded-full hover:bg-white/60 transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b border-[#EBE3D5] bg-gradient-to-b from-[#FFF5F2]/60 to-[#FAF7F2] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF0EB] border border-[#FFD9CE] text-[#FF5436] text-xs font-bold shadow-2xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Privacy First · Zero Data Sale</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[#181513] tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-[#666059] max-w-2xl mx-auto leading-relaxed">
            At duogo, friendship is built on mutual trust. We treat your personal stories, location,
            and match answers with the utmost respect, transparency, and military-grade encryption.
          </p>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Sticky Navigation Sidebar */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-20 rounded-3xl border border-[#EBE3D5] bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#EBE3D5]">
                <Lock className="h-4 w-4 text-[#FF5436]" />
                <h3 className="font-serif text-sm font-bold text-[#181513]">Contents</h3>
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all block",
                      activeSection === sec.id
                        ? "bg-[#FFF0EB] text-[#FF5436] font-bold shadow-2xs"
                        : "text-[#666059] hover:bg-[#FAF7F2] hover:text-[#181513]"
                    )}
                  >
                    {sec.label}
                  </button>
                ))}
              </nav>

              <div className="pt-3 border-t border-[#EBE3D5] text-[11px] text-[#888177] space-y-2">
                <p>Have questions about your data?</p>
                <a
                  href="mailto:sayhello@duogo.space"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF5436] hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>sayhello@duogo.space</span>
                </a>
              </div>
            </div>
          </aside>

          {/* Policy Text Articles */}
          <main className="lg:col-span-8 space-y-12">
            {/* Overview & Key Highlights */}
            <article id="overview" className="scroll-mt-24 space-y-5">
              <div className="rounded-3xl border border-[#FFD9CE] bg-gradient-to-br from-[#FFF8F5] to-white p-6 sm:p-8 space-y-4 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#FFF0EB] border border-[#FFD9CE] flex items-center justify-center text-[#FF5436]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#181513]">The duogo Privacy Pledge</h2>
                    <p className="text-xs text-[#888177]">The plain-English summary of how we protect you</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                    <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                      <EyeOff className="h-3.5 w-3.5 text-[#FF5436]" /> Double-Blind Reveal
                    </p>
                    <p className="text-[12px] text-[#666059] leading-relaxed">
                      Your identity, social handles, and clear photos stay blurred until both parties mutually accept a match.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                    <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-[#FF5436]" /> Zero Data Sale
                    </p>
                    <p className="text-[12px] text-[#666059] leading-relaxed">
                      We never sell, rent, or monetize your personal responses to data brokers or third-party ad networks.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                    <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-[#FF5436]" /> Approximate Location
                    </p>
                    <p className="text-[12px] text-[#666059] leading-relaxed">
                      We never track your real-time background GPS. We only use your selected city or neighborhood for proximity.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                    <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                      <Trash2 className="h-3.5 w-3.5 text-[#FF5436]" /> Right to Delete
                    </p>
                    <p className="text-[12px] text-[#666059] leading-relaxed">
                      You can pause matching or permanently wipe your account and all data at any moment with one click.
                    </p>
                  </div>
                </div>
              </div>
            </article>

            {/* Section 1: Information We Collect */}
            <article id="information-collected" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">1.</span> Information We Collect
              </h2>
              <p className="text-sm text-[#443F39] leading-relaxed">
                We only collect data necessary to provide authentic, highly compatible, and safe friendship introductions.
              </p>

              <div className="space-y-3 pt-2">
                <div className="rounded-2xl border border-[#EBE3D5] bg-white p-4.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#181513] flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-[#FF5436]" /> Account &amp; Identity Profile
                  </h3>
                  <p className="text-xs text-[#666059] leading-relaxed">
                    When creating an account, you provide your <strong>email address</strong> (used for secure passwordless login &amp; verification),
                    your <strong>first name</strong>, your partner's first name (if registering as a couple), your age group, gender identity,
                    and optional profile avatar photos.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#EBE3D5] bg-white p-4.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#181513] flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-[#FF5436]" /> Compatibility Radar &amp; Quiz Answers
                  </h3>
                  <p className="text-xs text-[#666059] leading-relaxed">
                    Our proprietary matching engine evaluates your responses to our lifestyle compatibility quiz (social battery,
                    weekend vibes, humor, communication pace, values, and parental status). These data points are stored in
                    encrypted database records and used strictly to compute match compatibility percentages.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#EBE3D5] bg-white p-4.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#181513] flex items-center gap-2">
                    <Database className="h-4 w-4 text-[#FF5436]" /> City &amp; Proximity Preferences
                  </h3>
                  <p className="text-xs text-[#666059] leading-relaxed">
                    You specify your general metropolitan city or neighborhood. <strong>We do not track continuous background GPS coordinates</strong>.
                    Your approximate location is solely used to verify that potential friends are within practical meet-up distance.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#EBE3D5] bg-white p-4.5 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#181513] flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#FF5436]" /> Chat Messages &amp; Safety Reports
                  </h3>
                  <p className="text-xs text-[#666059] leading-relaxed">
                    In-app messages exchanged between mutually confirmed matches are encrypted in transit and stored securely. If a match is reported
                    or flagged for safety violations, submitted transcripts and reasons are reviewed exclusively by our human trust &amp; safety team.
                  </p>
                </div>
              </div>
            </article>

            {/* Section 2: How We Use Your Data */}
            <article id="how-we-use" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">2.</span> How We Use Your Data
              </h2>
              <p className="text-sm text-[#443F39] leading-relaxed">
                We use collected information solely for the following explicit purposes:
              </p>
              <ul className="space-y-2 text-xs text-[#666059] list-none">
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EBE3D5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                  <span><strong>Candidate Matching:</strong> Calculating lifestyle alignment, conversational pacing, and couple-to-couple compatibility.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EBE3D5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                  <span><strong>Mutual Match Unlocks:</strong> Protecting privacy through double-blind approvals before revealing identities.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EBE3D5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                  <span><strong>Safety &amp; Anti-Spam:</strong> Protecting the duogo community from harassment, commercial solicitation, romance scammers, or hostile conduct.</span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#EBE3D5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] shrink-0 mt-0.5" />
                  <span><strong>Account Alerts &amp; Notifications:</strong> Sending push or email alerts when new mutual matches are ready or incoming messages arrive.</span>
                </li>
              </ul>
            </article>

            {/* Section 3: Double-Blind Match Privacy */}
            <article id="double-blind" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">3.</span> Double-Blind Match Privacy
              </h2>
              <div className="rounded-2xl border border-[#EBE3D5] bg-[#FFFBF8] p-5 space-y-3">
                <p className="text-sm text-[#443F39] leading-relaxed">
                  Unlike traditional public directories or open swipe feeds, duogo operates on a <strong>Double-Blind Protocol</strong>:
                </p>
                <div className="space-y-2 text-xs text-[#666059]">
                  <p>
                    • <strong>No Public Profiles:</strong> Strangers cannot browse, search, or index your profile on search engines.
                  </p>
                  <p>
                    • <strong>Blurred Candidate View:</strong> When a match candidate is proposed, photos and sensitive identifying details remain obscured. Only compatibility percentages and high-level lifestyle badges are visible.
                  </p>
                  <p>
                    • <strong>Mutual Consent Required:</strong> Both you and the other party must independently click "Connect" before photos unblur, first names are shared, and conversation unlocks.
                  </p>
                  <p>
                    • <strong>Rejection Privacy:</strong> If either party passes, the other party is never informed of the pass, preventing social awkwardness.
                  </p>
                </div>
              </div>
            </article>

            {/* Section 4: What We Never Do */}
            <article id="data-sharing" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">4.</span> What We Never Do (Zero Ad-Sale)
              </h2>
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#FF5436] font-bold text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Our Ironclad Guarantee</span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#666059] list-disc pl-5">
                  <li>We do <strong>NOT</strong> sell, rent, license, or barter your personal information to third parties or data brokers.</li>
                  <li>We do <strong>NOT</strong> serve third-party banner ads, programmatic ad networks, or behavioral retargeting pixels.</li>
                  <li>We do <strong>NOT</strong> share your quiz answers or private messages with employers, insurers, or commercial marketers.</li>
                  <li>We do <strong>NOT</strong> access your contacts address book without explicit manual permission.</li>
                </ul>
              </div>
            </article>

            {/* Section 5: Analytics & Third-Party Service Providers */}
            <article id="third-party" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">5.</span> Analytics &amp; Third-Party Services
              </h2>
              <p className="text-sm text-[#443F39] leading-relaxed">
                To maintain high reliability, prevent bugs, and measure application health, we partner with trusted, privacy-compliant infrastructure providers:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-white border border-[#EBE3D5] space-y-1.5">
                  <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-[#FF5436]" /> Supabase (Database &amp; Auth)
                  </p>
                  <p className="text-[12px] text-[#666059] leading-relaxed">
                    Houses encrypted customer records, authentication tokens, and Postgres Row Level Security (RLS) enforcement.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#EBE3D5] space-y-1.5">
                  <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-[#FF5436]" /> PostHog (Product Analytics &amp; Surveys)
                  </p>
                  <p className="text-[12px] text-[#666059] leading-relaxed">
                    Used for anonymous usage telemetry, crash diagnostics, and voluntary user feedback surveys. Does not track across other websites.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#EBE3D5] space-y-1.5">
                  <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5 text-[#FF5436]" /> Microsoft Clarity (UX Diagnostics)
                  </p>
                  <p className="text-[12px] text-[#666059] leading-relaxed">
                    Masked session recordings and layout heatmaps to detect broken buttons and layout glitches. All keystrokes and sensitive text inputs are masked.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#EBE3D5] space-y-1.5">
                  <p className="text-xs font-bold text-[#181513] flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[#FF5436]" /> Resend (Transactional Email)
                  </p>
                  <p className="text-[12px] text-[#666059] leading-relaxed">
                    Delivers one-time magic links and instant notification emails. We never send spam marketing.
                  </p>
                </div>
              </div>
            </article>

            {/* Section 6: Security & Storage */}
            <article id="security-retention" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">6.</span> Security &amp; Data Retention
              </h2>
              <div className="space-y-3 text-xs sm:text-sm text-[#443F39] leading-relaxed">
                <p>
                  All network communication is strictly enforced via <strong>HTTPS / TLS 1.3</strong> encryption. Stored records are safeguarded with database-level encryption at rest (AES-256) and strict Row Level Security policies preventing unauthorized cross-user queries.
                </p>
                <p>
                  <strong>Retention Period:</strong> We retain your profile data as long as your account remains active. If you pause matching, your profile is hidden from the candidate pool but retained until you return. If you choose to delete your account, your profile, match history, and quiz answers are permanently wiped within 30 days.
                </p>
              </div>
            </article>

            {/* Section 7: Your Rights & Account Deletion */}
            <article id="your-rights" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">7.</span> Your Rights &amp; Account Deletion
              </h2>
              <p className="text-sm text-[#443F39] leading-relaxed">
                Regardless of where you reside (including GDPR, CCPA/CPRA, and UK GDPR protections), you retain full sovereignty over your data:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#666059]">
                <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                  <p className="font-bold text-[#181513]">Right of Access &amp; Portability</p>
                  <p>Request an export of all information duogo holds regarding your identity and quiz answers.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                  <p className="font-bold text-[#181513]">Right to Erasure (Be Forgotten)</p>
                  <p>Permanently delete your profile and account in Settings with a single click.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                  <p className="font-bold text-[#181513]">Right to Correction</p>
                  <p>Edit or retake your compatibility quiz at any time to adjust your social radar.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#EBE3D5] space-y-1">
                  <p className="font-bold text-[#181513]">Right to Restrict &amp; Pause</p>
                  <p>Toggle "Pause Matching" at any moment to take a break without losing your profile.</p>
                </div>
              </div>
            </article>

            {/* Section 8: Cookies & Storage */}
            <article id="cookies" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">8.</span> Cookies &amp; Local Storage
              </h2>
              <div className="rounded-2xl border border-[#EBE3D5] bg-white p-5 space-y-2 text-xs sm:text-sm text-[#443F39] leading-relaxed">
                <p className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#181513]">
                  <Cookie className="h-4 w-4 text-[#FF5436]" /> Essential &amp; Offline Storage
                </p>
                <p>
                  duogo is built as an offline-first Progressive Web App (PWA). We use browser <strong>LocalStorage</strong> and <strong>IndexedDB</strong> to store your session authentication tokens and allow you to view cached matches without an active internet connection.
                </p>
                <p className="text-xs text-[#666059]">
                  We do not use advertising or tracking cookies from third-party advertising exchanges.
                </p>
              </div>
            </article>

            {/* Section 9: Contact */}
            <article id="contact" className="scroll-mt-24 space-y-4">
              <h2 className="font-serif text-2xl font-bold text-[#181513] flex items-center gap-2">
                <span className="text-[#FF5436]">9.</span> Contact &amp; Data Officer
              </h2>
              <div className="rounded-2xl border border-[#EBE3D5] bg-white p-6 space-y-3">
                <p className="text-xs sm:text-sm text-[#443F39] leading-relaxed">
                  If you have questions about this policy, wish to submit a data subject access request (DSAR), or want to report a privacy concern, please reach out to our privacy team directly:
                </p>
                <div className="space-y-1 pt-1 text-xs">
                  <p className="font-bold text-[#181513]">duogo Trust &amp; Privacy Operations</p>
                  <p className="text-[#666059]">
                    Email:{" "}
                    <a
                      href="mailto:sayhello@duogo.space"
                      className="text-[#FF5436] font-semibold hover:underline"
                    >
                      sayhello@duogo.space
                    </a>
                  </p>
                  <p className="text-[#888177]">Expected response time: within 48 business hours.</p>
                </div>
              </div>
            </article>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#EBE3D5] bg-white py-8 px-4 sm:px-8 text-center text-xs text-[#888177]">
        <div className="max-w-4xl mx-auto space-y-2">
          <p>© {new Date().getFullYear()} duogo. All rights reserved. Made for genuine friendship.</p>
          <div className="flex items-center justify-center gap-4 text-xs font-medium text-[#666059]">
            <Link to="/privacy" className="hover:text-[#FF5436]">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-[#FF5436]">Terms of Service</Link>
            <span>•</span>
            <Link to="/" className="hover:text-[#FF5436]">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;
