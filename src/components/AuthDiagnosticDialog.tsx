import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  runAuthDiagnostic,
  AuthDiagnosticReport,
  getStoredDiagnosticHistory,
  clearDiagnosticHistory,
  exportAuthDiagnosticsAsJson,
} from "@/lib/authDiagnostics";
import { clearSignupDraft } from "@/lib/signupState";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
  Terminal,
  Trash2,
  XCircle,
  HelpCircle,
} from "lucide-react";

interface AuthDiagnosticDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AuthDiagnosticDialog = ({ open, onOpenChange }: AuthDiagnosticDialogProps) => {
  const [report, setReport] = useState<AuthDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await runAuthDiagnostic({ source: "diagnostic_modal_ui", verbose: true });
      setReport(res);
    } catch (e) {
      console.error("Diagnostic error:", e);
      toast({
        title: "Diagnostic error",
        description: "Failed to generate auth diagnostic report.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      // Load most recent report from history or run a fresh one
      const history = getStoredDiagnosticHistory();
      if (history.length > 0) {
        setReport(history[0]);
      } else {
        fetchDiagnostic();
      }
    }
  }, [open]);

  const handleCopy = () => {
    const json = exportAuthDiagnosticsAsJson();
    navigator.clipboard.writeText(json);
    setCopied(true);
    toast({ title: "Copied to clipboard", description: "Full diagnostic JSON copied." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearDraft = () => {
    clearSignupDraft();
    toast({
      title: "Draft cleared",
      description: "Local storage signup draft has been cleared. Running fresh check...",
    });
    fetchDiagnostic();
  };

  const getStatusBadge = (status?: string, severity?: string) => {
    if (severity === "critical" || status === "PROFILE_AUTH_ID_MISMATCH") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3.5 h-3.5" />
          Critical Desync: Re-initialized Net New
        </span>
      );
    }
    if (severity === "high" || status === "REINITIALIZED_EXISTING_USER_BUG") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Old Account With Empty Profile
        </span>
      );
    }
    if (status === "HEALTHY_RETURNING_USER") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Healthy Returning User
        </span>
      );
    }
    if (status === "LEGITIMATE_NEW_SIGNUP") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Activity className="w-3.5 h-3.5" />
          Legitimate Net-New Signup
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-200">
        <HelpCircle className="w-3.5 h-3.5" />
        {status || "Unknown Status"}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#FAF7F2] text-[#1A1816] p-6 sm:p-7 border border-[#EFE8DD] rounded-3xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="font-serif text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-[#FF5436]" />
              Auth &amp; Profile Diagnostic
            </DialogTitle>
            {report && getStatusBadge(report.status, report.overallSeverity)}
          </div>
          <DialogDescription className="text-xs text-[#706A62]">
            Compares active Supabase Auth session metadata against public.profiles to diagnose re-initialization bugs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Quick Action Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#EFE8DD] pb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDiagnostic}
              disabled={loading}
              className="rounded-xl border-[#EFE8DD] bg-white hover:bg-stone-50 text-xs font-bold gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Run Fresh Diagnostic
            </Button>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="rounded-xl border-[#EFE8DD] bg-white hover:bg-stone-50 text-xs font-medium gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Copied!" : "Copy JSON"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearDraft}
                className="rounded-xl text-stone-600 hover:text-red-600 text-xs font-medium gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Local Draft
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 rounded-full border-3 border-[#FF5436] border-t-transparent animate-spin" />
              <p className="text-xs font-medium text-stone-500">Querying Supabase Auth &amp; Profiles...</p>
            </div>
          ) : report ? (
            <div className="space-y-4 text-xs">
              {/* Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#EFE8DD] shadow-sm">
                <p className="font-semibold text-stone-900 mb-1">{report.summary}</p>
                <p className="text-[11px] text-stone-500">
                  Triggered via: <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">{report.source}</code> • {new Date(report.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {/* Detected Issues */}
              {report.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-stone-600">
                    Detected Discrepancies ({report.issues.length})
                  </h4>
                  <div className="space-y-2.5">
                    {report.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border ${
                          issue.severity === "critical"
                            ? "bg-red-50/80 border-red-200 text-red-900"
                            : issue.severity === "high"
                            ? "bg-amber-50/80 border-amber-200 text-amber-900"
                            : "bg-stone-50 border-stone-200 text-stone-900"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-white/80 border border-black/10">
                            {issue.severity}
                          </span>
                          <span className="font-bold text-sm">{issue.title}</span>
                        </div>
                        <p className="text-xs mt-1 text-stone-700 leading-relaxed">{issue.description}</p>
                        <div className="mt-2 pt-2 border-t border-black/5 text-[11px] space-y-1">
                          <p>
                            <strong className="text-stone-900">Why user is re-initialized:</strong> {issue.impact}
                          </p>
                          <p>
                            <strong className="text-stone-900">Fix:</strong> {issue.suggestedFix}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Column 1: Supabase Auth Session */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#EFE8DD] space-y-2">
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-[#FF5436]">
                    Supabase Auth Metadata
                  </h5>
                  <div className="space-y-1.5 text-[11.5px]">
                    <div>
                      <span className="text-stone-500">Session User ID:</span>
                      <p className="font-mono text-[11px] text-stone-800 break-all select-all">
                        {report.auth.userId || "(no active session)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Email:</span>
                      <p className="font-semibold text-stone-800">{report.auth.email || "n/a"}</p>
                    </div>
                    <div>
                      <span className="text-stone-500">Account Created:</span>
                      <p className="text-stone-800">
                        {report.auth.createdAt ? new Date(report.auth.createdAt).toLocaleString() : "n/a"}{" "}
                        {report.auth.accountAgeMinutes !== null && (
                          <span className="font-bold text-[#FF5436]">
                            ({report.auth.accountAgeMinutes}m ago)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Provider:</span>
                      <p className="text-stone-800 font-medium">
                        {(report.auth.appMetadata?.provider as string) || "email"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Column 2: Profiles Database Row */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#EFE8DD] space-y-2">
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-[#FF5436]">
                    Database Profile Table
                  </h5>
                  <div className="space-y-1.5 text-[11.5px]">
                    <div>
                      <span className="text-stone-500">Row Found by ID:</span>
                      <p className="font-semibold text-stone-800">
                        {report.profiles.foundById ? "✅ Found in profiles table" : "❌ Missing profile row"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">First Name / User Type:</span>
                      <p className="font-semibold text-stone-800">
                        {(report.profiles.profileById?.first_name as string) || "(empty)"} /{" "}
                        {(report.profiles.profileById?.user_type as string) || "(empty)"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Onboarding Flags:</span>
                      <p className="text-stone-800 space-x-1.5">
                        <span className={`font-semibold ${report.profiles.onboardingCompleted ? "text-emerald-600" : "text-amber-600"}`}>
                          onboarding: {report.profiles.onboardingCompleted ? "true" : "false"}
                        </span>
                        <span>•</span>
                        <span className={`font-semibold ${report.profiles.quizCompleted ? "text-emerald-600" : "text-amber-600"}`}>
                          quiz: {report.profiles.quizCompleted ? "true" : "false"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-500">Quiz Responses in DB:</span>
                      <p className="text-stone-800 font-semibold">
                        {report.related.hasQuizResponses ? "✅ Record exists" : "None in quiz_responses table"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Local Storage Draft */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#EFE8DD] space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-[11px] uppercase tracking-wider text-stone-600">
                    Local Client Storage (localStorage)
                  </h5>
                  <span className="text-[11px] font-semibold text-stone-500">
                    {report.clientState.hasLocalDraft ? "Draft Active" : "No Draft"}
                  </span>
                </div>
                <div className="text-[11.5px] text-stone-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-stone-500 block text-[10.5px]">Draft User Type</span>
                    <span className="font-semibold">{report.clientState.draft.user_type || "(none)"}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10.5px]">Draft Name</span>
                    <span className="font-semibold">{report.clientState.draft.first_name || "(none)"}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10.5px]">Draft Quiz Done</span>
                    <span className="font-semibold">{report.clientState.draft.quiz_completed ? "true" : "false"}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10.5px]">Draft Privacy</span>
                    <span className="font-semibold">{report.clientState.draft.privacy_consented ? "true" : "false"}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-500 text-center py-6">No diagnostic report available.</p>
          )}

          <div className="text-[11px] text-stone-500 text-center pt-2">
            💡 Pro tip: You can also run <code className="bg-stone-200 px-1.5 py-0.5 rounded text-stone-800 font-mono">runAuthDiagnostic()</code> in DevTools Console anytime.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
