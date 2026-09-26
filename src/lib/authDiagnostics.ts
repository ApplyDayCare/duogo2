import { supabase } from "@/integrations/supabase/client";
import { getSignupDraft, SignupDraft } from "@/lib/signupState";

export interface DiagnosticIssue {
  code: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  impact: string;
  suggestedFix: string;
}

export interface AuthDiagnosticReport {
  timestamp: string;
  source: string;
  status:
    | "HEALTHY_RETURNING_USER"
    | "LEGITIMATE_NEW_SIGNUP"
    | "REINITIALIZED_EXISTING_USER_BUG"
    | "PROFILE_AUTH_ID_MISMATCH"
    | "PROFILE_MISSING_FOR_AUTH_USER"
    | "ORPHANED_QUIZ_DESYNC"
    | "ANONYMOUS_NO_SESSION";
  overallSeverity: "none" | "low" | "medium" | "high" | "critical";
  summary: string;

  // 1. Supabase Auth Session & Metadata
  auth: {
    hasSession: boolean;
    userId: string | null;
    email: string | null;
    createdAt: string | null;
    accountAgeMinutes: number | null;
    isOldAccount: boolean;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    appMetadata: Record<string, unknown> | null;
    userMetadata: Record<string, unknown> | null;
  };

  // 2. Profiles Table state
  profiles: {
    queriedId: string | null;
    foundById: boolean;
    profileById: Record<string, unknown> | null;
    foundByEmail: boolean;
    profilesByEmailCount: number;
    profileByEmail: Record<string, unknown> | null;
    idMatchesEmailProfile: boolean;
    emailCasingMatch: boolean;
    hasUserType: boolean;
    hasFirstName: boolean;
    onboardingCompleted: boolean;
    quizCompleted: boolean;
    privacyConsented: boolean;
    queryError: string | null;
  };

  // 3. Related tables
  related: {
    hasQuizResponses: boolean;
    quizResponseId: string | null;
    quizCreatedAt: string | null;
    hasCoupleRecord: boolean;
    coupleRole: "partner_a" | "partner_b" | null;
    bothVerified: boolean | null;
  };

  // 4. Local client storage
  clientState: {
    hasLocalDraft: boolean;
    draft: SignupDraft;
    draftEmail: string | null;
    draftEmailMatchesAuth: boolean;
    draftWouldOverwriteProfile: boolean;
    hasReferralCode: boolean;
  };

  // 5. Detected issues & recommendations
  issues: DiagnosticIssue[];
}

const STORAGE_HISTORY_KEY = "duogo_auth_diagnostics_history";
const MAX_STORED_HISTORY = 25;

/**
 * Runs a deep diagnostic comparing the Supabase 'auth' session metadata
 * against the 'profiles', 'quiz_responses', and 'couples' tables, as well as
 * local signup drafts, to identify why users are being re-initialized as net new.
 */
export async function runAuthDiagnostic(options?: {
  source?: string;
  verbose?: boolean;
  suppressLog?: boolean;
}): Promise<AuthDiagnosticReport> {
  const source = options?.source || "manual_invocation";
  const timestamp = new Date().toISOString();

  // 1. Fetch Auth session and user metadata
  let session = null;
  let authUser = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    authUser = session?.user || null;
  } catch (err: unknown) {
    console.warn("[AuthDiagnostic] Failed to read auth session:", err);
  }

  // Fallback to getUser() if session user is null but token might exist
  if (!authUser) {
    try {
      const { data } = await supabase.auth.getUser();
      authUser = data.user || null;
    } catch {
      // ignore
    }
  }

  const userId = authUser?.id || null;
  const authEmail = authUser?.email?.trim() || null;
  const createdAtStr = authUser?.created_at || null;
  const accountAgeMinutes = createdAtStr
    ? Math.max(0, Math.round((Date.now() - new Date(createdAtStr).getTime()) / (1000 * 60)))
    : null;
  const isOldAccount = accountAgeMinutes !== null && accountAgeMinutes > 5;

  // 2. Query 'profiles' table by user.id
  let profileById: Record<string, unknown> | null = null;
  let queryError: string | null = null;

  if (userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        queryError = error.message;
      } else {
        profileById = (data as Record<string, unknown>) || null;
      }
    } catch (err: any) {
      queryError = err?.message || String(err);
    }
  }

  // 3. Query 'profiles' table by email to detect split/duplicate accounts or ID mismatch
  let profilesByEmail: Record<string, unknown>[] = [];
  if (authEmail) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", authEmail);

      profilesByEmail = (data as Record<string, unknown>[]) || [];
    } catch (err: unknown) {
      console.warn("[AuthDiagnostic] Profile email lookup notice:", err);
    }
  }

  const profileByEmail = profilesByEmail[0] || null;
  const idMatchesEmailProfile = Boolean(
    profileByEmail && userId && profileByEmail.id === userId
  );
  const emailCasingMatch = Boolean(
    profileById?.email && authEmail && profileById.email === authEmail
  );

  // 4. Query 'quiz_responses' table
  let hasQuizResponses = false;
  let quizResponseId: string | null = null;
  let quizCreatedAt: string | null = null;
  if (userId) {
    try {
      const { data } = await supabase
        .from("quiz_responses")
        .select("id, created_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        hasQuizResponses = true;
        quizResponseId = (data as any).id;
        quizCreatedAt = (data as any).created_at;
      }
    } catch {
      // ignore
    }
  }

  // 5. Query 'couples' table
  let hasCoupleRecord = false;
  let coupleRole: "partner_a" | "partner_b" | null = null;
  let bothVerified: boolean | null = null;
  if (userId) {
    try {
      const { data } = await supabase
        .from("couples")
        .select("id, partner_a_id, partner_b_id, both_verified")
        .or(`partner_a_id.eq.${userId},partner_b_id.eq.${userId}`)
        .maybeSingle();

      if (data) {
        hasCoupleRecord = true;
        coupleRole = (data as any).partner_a_id === userId ? "partner_a" : "partner_b";
        bothVerified = Boolean((data as any).both_verified);
      }
    } catch {
      // ignore
    }
  }

  // 6. Inspect local client draft
  const draft = getSignupDraft();
  const hasLocalDraft = Boolean(
    draft &&
    (draft.user_type || draft.first_name || draft.quiz_answers || draft.age_group || draft.email)
  );
  const draftEmail = draft.email?.trim() || null;
  const draftEmailMatchesAuth = Boolean(
    draftEmail && authEmail && draftEmail.toLowerCase() === authEmail.toLowerCase()
  );

  const targetProfile = profileById || profileByEmail;
  const draftWouldOverwriteProfile = Boolean(
    targetProfile &&
    targetProfile.first_name &&
    hasLocalDraft &&
    !draft.first_name
  );

  const hasReferralCode = Boolean(localStorage.getItem("duogo_referral_code"));

  // 7. Heuristic Issues Analysis
  const issues: DiagnosticIssue[] = [];

  if (!authUser) {
    // Anonymous
    issues.push({
      code: "NO_AUTH_SESSION",
      severity: "info",
      title: "No Active Supabase Auth Session",
      description: "User is currently anonymous or logged out. The signup flow will treat them as a new visitor.",
      evidence: { sessionExists: false },
      impact: "User will be presented with onboarding setup or signup screens.",
      suggestedFix: "If user previously registered, they must log in via 'Sign In' with OTP.",
    });
  } else {
    // 7A. Auth user exists but profile row is completely missing
    if (!profileById && !queryError) {
      if (profileByEmail) {
        issues.push({
          code: "AUTH_PROFILE_ID_MISMATCH",
          severity: "critical",
          title: "Auth User ID Does Not Match Profile ID",
          description: `An existing profile was found for email '${authEmail}', but its ID (${profileByEmail.id}) does not match the active Supabase auth.users ID (${userId}).`,
          evidence: {
            authUserId: userId,
            existingProfileId: profileByEmail.id,
            email: authEmail,
          },
          impact: "The app queries profiles by session user ID, finds nothing, and creates a fresh uninitialized account, re-initializing the user as net new!",
          suggestedFix: "Check if the user was re-created in Supabase Auth or signed in via a different OAuth provider without account linking.",
        });
      } else {
        issues.push({
          code: "MISSING_PROFILE_ROW",
          severity: "high",
          title: "No Profile Row for Authenticated User",
          description: `User ${userId} exists in Supabase Auth (created ${accountAgeMinutes}m ago), but no row exists in public.profiles.`,
          evidence: { authUserId: userId, authEmail, accountAgeMinutes },
          impact: "App cannot load profile data and routes the user into the onboarding wizard as a blank slate.",
          suggestedFix: "Verify that the PostgreSQL trigger 'handle_new_user' on auth.users is active and not failing on insert.",
        });
      }
    }

    // 7B. Query error (RLS or Network)
    if (queryError) {
      issues.push({
        code: "PROFILE_QUERY_ERROR",
        severity: "critical",
        title: "Database Query Error Fetching Profile",
        description: `Failed to query public.profiles: ${queryError}`,
        evidence: { queryError, authUserId: userId },
        impact: "The frontend receives null for profile, assuming the user has not completed onboarding.",
        suggestedFix: "Verify RLS policies on public.profiles allow authenticated users to SELECT their own row.",
      });
    }

    // 7C. Profile exists but is an empty uninitialized stub
    if (profileById) {
      const hasCompletedFlags = Boolean(
        profileById.onboarding_completed && profileById.quiz_completed
      );
      const isStub =
        !profileById.user_type &&
        !profileById.first_name &&
        !profileById.onboarding_completed &&
        !profileById.quiz_completed;

      if (isOldAccount && isStub) {
        issues.push({
          code: "OLD_AUTH_STUB_PROFILE",
          severity: "high",
          title: "Account Created In The Past But Profile Never Initialized",
          description: `User account was created ${accountAgeMinutes} minutes ago in Supabase Auth, but the profile row contains default NULL/false fields.`,
          evidence: {
            authCreated: createdAtStr,
            accountAgeMinutes,
            userType: profileById.user_type,
            firstName: profileById.first_name,
            onboardingCompleted: profileById.onboarding_completed,
            quizCompleted: profileById.quiz_completed,
          },
          impact: "When this user logs in or verifies their email, the app treats them as an incomplete onboarding lead and routes them back to Step 1.",
          suggestedFix: "Ensure syncSignupDraftToSupabase commits all draft attributes before the session completes, and ensure users are prompted to finish setup.",
        });
      }

      // 7D. Orphaned Quiz Responses: Quiz row exists in DB, but quiz_completed flag is false
      if (hasQuizResponses && !profileById.quiz_completed) {
        issues.push({
          code: "ORPHANED_QUIZ_DESYNC",
          severity: "high",
          title: "Quiz Responses Exist but Profile Flag Is False",
          description: "A completed quiz record exists in public.quiz_responses, but profiles.quiz_completed is false or null.",
          evidence: {
            quizResponseId,
            quizCreatedAt,
            profileQuizCompleted: profileById.quiz_completed,
          },
          impact: "User is repeatedly prompted to take the quiz or blocked from viewing matches, being treated as incomplete.",
          suggestedFix: "Flip profiles.quiz_completed = true to match existing quiz_responses record.",
        });
      }

      // 7E. Onboarding flag vs Quiz flag mismatch
      if (profileById.onboarding_completed && !profileById.quiz_completed && !hasQuizResponses) {
        issues.push({
          code: "ONBOARDING_DONE_BUT_QUIZ_MISSING",
          severity: "medium",
          title: "Onboarding Marked Complete Without Quiz",
          description: "profiles.onboarding_completed is true, but quiz_completed is false. Route guards will bounce the user to /quiz.",
          evidence: {
            onboardingCompleted: profileById.onboarding_completed,
            quizCompleted: profileById.quiz_completed,
          },
          impact: "User is directed to the quiz instead of dashboard, which can feel like repeating onboarding.",
          suggestedFix: "Guide user directly to quiz completion or auto-sync draft quiz answers.",
        });
      }

      // 7F. Email casing mismatch
      if (authEmail && profileById.email && authEmail !== profileById.email) {
        issues.push({
          code: "EMAIL_CASING_MISMATCH",
          severity: "medium",
          title: "Auth Email and Profile Email Casing Discrepancy",
          description: `Auth email is '${authEmail}' while Profile email is '${profileById.email}'.`,
          evidence: { authEmail, profileEmail: profileById.email },
          impact: "Case-sensitive equality checks will fail, causing login lookups to miss the registered profile.",
          suggestedFix: "Always normalize emails using .trim().toLowerCase() across all auth and database calls.",
        });
      }

      // 7G. Local Draft Overwrite Hazard
      if (hasCompletedFlags && hasLocalDraft && !draft.first_name) {
        issues.push({
          code: "LOCAL_DRAFT_OVERWRITE_HAZARD",
          severity: "high",
          title: "Stale Local Draft Risks Overwriting Completed Profile",
          description: "User has a complete profile in Supabase, but the browser has an incomplete signup draft in localStorage.",
          evidence: {
            dbFirstName: profileById.first_name,
            dbUserType: profileById.user_type,
            localDraft,
          },
          impact: "If syncSignupDraftToSupabase runs, it may overwrite established user data with empty draft values.",
          suggestedFix: "Clear the local signup draft immediately upon finding an active completed profile.",
        });
      }
    }
  }

  // 8. Determine overall status & severity
  let status: AuthDiagnosticReport["status"] = "HEALTHY_RETURNING_USER";
  let overallSeverity: AuthDiagnosticReport["overallSeverity"] = "none";
  let summary = "";

  if (!authUser) {
    status = "ANONYMOUS_NO_SESSION";
    overallSeverity = "none";
    summary = "No active session detected. Browser is operating in guest/anonymous mode.";
  } else if (issues.some((i) => i.code === "AUTH_PROFILE_ID_MISMATCH")) {
    status = "PROFILE_AUTH_ID_MISMATCH";
    overallSeverity = "critical";
    summary = "CRITICAL: Auth user ID does not match the profile registered with this email address.";
  } else if (issues.some((i) => i.code === "MISSING_PROFILE_ROW" || i.code === "PROFILE_QUERY_ERROR")) {
    status = "PROFILE_MISSING_FOR_AUTH_USER";
    overallSeverity = "high";
    summary = "Auth session exists, but database profile could not be loaded or does not exist.";
  } else if (issues.some((i) => i.code === "ORPHANED_QUIZ_DESYNC")) {
    status = "ORPHANED_QUIZ_DESYNC";
    overallSeverity = "high";
    summary = "User has completed quiz answers in DB, but the profile table flag is out of sync.";
  } else if (issues.some((i) => i.code === "OLD_AUTH_STUB_PROFILE")) {
    status = "REINITIALIZED_EXISTING_USER_BUG";
    overallSeverity = "high";
    summary = `Auth user was created ${accountAgeMinutes}m ago, but has an empty stub profile. Being treated as net-new.`;
  } else if (!isOldAccount && (!profileById || !profileById.onboarding_completed)) {
    status = "LEGITIMATE_NEW_SIGNUP";
    overallSeverity = "none";
    summary = "Legitimate new user signup in progress (auth account created recently).";
  } else {
    status = "HEALTHY_RETURNING_USER";
    overallSeverity = issues.length > 0 ? "low" : "none";
    summary = "Profile and Auth session are healthy and synchronized.";
  }

  const report: AuthDiagnosticReport = {
    timestamp,
    source,
    status,
    overallSeverity,
    summary,
    auth: {
      hasSession: Boolean(session),
      userId,
      email: authEmail,
      createdAt: createdAtStr,
      accountAgeMinutes,
      isOldAccount,
      lastSignInAt: authUser?.last_sign_in_at || null,
      emailConfirmedAt: (authUser as any)?.email_confirmed_at || (authUser as any)?.confirmed_at || null,
      appMetadata: (authUser?.app_metadata as Record<string, unknown>) || null,
      userMetadata: (authUser?.user_metadata as Record<string, unknown>) || null,
    },
    profiles: {
      queriedId: userId,
      foundById: Boolean(profileById),
      profileById,
      foundByEmail: Boolean(profileByEmail),
      profilesByEmailCount: profilesByEmail.length,
      profileByEmail,
      idMatchesEmailProfile,
      emailCasingMatch,
      hasUserType: Boolean(profileById?.user_type),
      hasFirstName: Boolean(profileById?.first_name),
      onboardingCompleted: Boolean(profileById?.onboarding_completed),
      quizCompleted: Boolean(profileById?.quiz_completed),
      privacyConsented: Boolean(profileById?.privacy_consented),
      queryError,
    },
    related: {
      hasQuizResponses,
      quizResponseId,
      quizCreatedAt,
      hasCoupleRecord,
      coupleRole,
      bothVerified,
    },
    clientState: {
      hasLocalDraft,
      draft,
      draftEmail,
      draftEmailMatchesAuth,
      draftWouldOverwriteProfile,
      hasReferralCode,
    },
    issues,
  };

  // 9. Store in SessionStorage for history inspection across page reloads
  storeDiagnosticReport(report);

  // 10. Log formatted output unless suppressed
  if (!options?.suppressLog) {
    printAuthDiagnostic(report, options?.verbose);
  }

  return report;
}

/**
 * Pretty-prints the diagnostic report to the console using clear groups, tables, and colors.
 */
export function printAuthDiagnostic(report: AuthDiagnosticReport, verbose = false) {
  const badgeColor =
    report.overallSeverity === "critical"
      ? "background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;"
      : report.overallSeverity === "high"
      ? "background: #e67e22; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;"
      : report.overallSeverity === "medium"
      ? "background: #f1c40f; color: black; padding: 2px 6px; border-radius: 4px; font-weight: bold;"
      : "background: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;";

  console.groupCollapsed(
    `%c[Auth Diagnostic]%c [${report.status}] ${report.summary} (%c${report.source}%c)`,
    badgeColor,
    "color: inherit; font-weight: bold; margin-left: 6px;",
    "color: #888; font-style: italic;",
    "color: inherit;"
  );

  console.log("🕒 Timestamp:", report.timestamp);
  console.log("🎯 Source Trigger:", report.source);
  console.log("📝 Summary:", report.summary);

  // Quick comparison table
  console.table({
    "Auth User ID": { Value: report.auth.userId || "(none)" },
    "Auth Email": { Value: report.auth.email || "(none)" },
    "Account Age": { Value: report.auth.accountAgeMinutes !== null ? `${report.auth.accountAgeMinutes} min` : "n/a" },
    "Profile Found By ID": { Value: report.profiles.foundById ? "YES" : "NO" },
    "Profile First Name": { Value: (report.profiles.profileById?.first_name as string) || "(none)" },
    "Profile User Type": { Value: (report.profiles.profileById?.user_type as string) || "(none)" },
    "Onboarding Completed": { Value: report.profiles.onboardingCompleted ? "TRUE" : "FALSE" },
    "Quiz Completed": { Value: report.profiles.quizCompleted ? "TRUE" : "FALSE" },
    "Quiz Responses in DB": { Value: report.related.hasQuizResponses ? "YES" : "NO" },
    "Local Draft Present": { Value: report.clientState.hasLocalDraft ? "YES" : "NO" },
  });

  if (report.issues.length > 0) {
    console.group("⚠️ Detected Issues & Discrepancies (" + report.issues.length + ")");
    report.issues.forEach((iss, idx) => {
      console.warn(
        `#${idx + 1} [${iss.severity.toUpperCase()}] ${iss.title}\n` +
        `• Impact: ${iss.impact}\n` +
        `• Root Cause: ${iss.description}\n` +
        `• Suggested Fix: ${iss.suggestedFix}`,
        iss.evidence
      );
    });
    console.groupEnd();
  } else {
    console.log("✅ No discrepancies detected. Auth session and Profile table are synchronized.");
  }

  if (verbose) {
    console.group("🔍 Raw Diagnostic Payload");
    console.log("Auth Metadata:", report.auth);
    console.log("Profiles Record:", report.profiles);
    console.log("Related Records:", report.related);
    console.log("Client Storage Draft:", report.clientState);
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Persists reports to sessionStorage so they survive page reloads and redirects.
 */
function storeDiagnosticReport(report: AuthDiagnosticReport) {
  try {
    const raw = sessionStorage.getItem(STORAGE_HISTORY_KEY);
    const history: AuthDiagnosticReport[] = raw ? JSON.parse(raw) : [];
    history.unshift(report);
    if (history.length > MAX_STORED_HISTORY) {
      history.length = MAX_STORED_HISTORY;
    }
    sessionStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

/**
 * Retrieves the stored diagnostic history from sessionStorage.
 */
export function getStoredDiagnosticHistory(): AuthDiagnosticReport[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clears stored diagnostic reports.
 */
export function clearDiagnosticHistory() {
  try {
    sessionStorage.removeItem(STORAGE_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Exports all diagnostic reports as a formatted JSON string for support / debugging tickets.
 */
export function exportAuthDiagnosticsAsJson(): string {
  const history = getStoredDiagnosticHistory();
  return JSON.stringify(history, null, 2);
}

// Global browser window bindings for instant terminal/console debugging
if (typeof window !== "undefined") {
  (window as any).runAuthDiagnostic = runAuthDiagnostic;
  (window as any).getAuthDiagnostics = getStoredDiagnosticHistory;
  (window as any).clearAuthDiagnostics = clearDiagnosticHistory;
  (window as any).exportAuthDiagnostics = exportAuthDiagnosticsAsJson;
  (window as any).__DUOGO_AUTH_DIAGNOSTICS__ = {
    run: runAuthDiagnostic,
    getHistory: getStoredDiagnosticHistory,
    clear: clearDiagnosticHistory,
    exportJson: exportAuthDiagnosticsAsJson,
  };
}
