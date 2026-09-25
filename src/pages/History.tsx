import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCouplePartnerId, resolveOtherId } from "@/lib/coupleUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, CheckCircle, Clock, XCircle, Eye, MessageCircle } from "lucide-react";
import MatchActions from "@/components/MatchActions";

interface MatchRecord {
  id: string;
  status: string;
  compatibility_score: number;
  created_at: string;
  revealed_at: string | null;
  user_a_id: string;
  user_b_id: string;
  user_a_action: string | null;
  user_b_action: string | null;
  otherName?: string;
  feedback?: { met_in_person: string; rating: number | null };
  unreadCount?: number;
}

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get couple partner ID if applicable
      const partnerId = await getCouplePartnerId(user.id);

      // Build query filter: include partner's matches too
      const filterParts = [`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`];
      if (partnerId) {
        filterParts.push(`user_a_id.eq.${partnerId},user_b_id.eq.${partnerId}`);
      }

      const { data: rawMatches } = await supabase
        .from("matches")
        .select("*")
        .or(filterParts.join(","))
        .order("created_at", { ascending: false });

      if (!rawMatches) { setLoading(false); return; }

      // Deduplicate (in case both partners are on the same match)
      const seen = new Set<string>();
      const uniqueMatches = rawMatches.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      // Fetch other user names and feedback
      const enriched = await Promise.all(
        uniqueMatches.map(async (m) => {
          const otherId = resolveOtherId(m, user.id, partnerId);
          const [profileRes, feedbackRes] = await Promise.all([
            m.status === "mutual" || m.status === "archived" || m.status === "expired"
              ? supabase.from("profiles").select("first_name").eq("id", otherId).single()
              : Promise.resolve({ data: null }),
            supabase.from("pulse_feedback").select("met_in_person, rating").eq("match_id", m.id).eq("user_id", user.id).maybeSingle(),
          ]);

          // Count unread messages for mutual matches
          let unreadCount = 0;
          if (m.status === "mutual") {
            // Get my last sent message timestamp
            const { data: myLastMsg } = await supabase
              .from("messages")
              .select("created_at")
              .eq("match_id", m.id)
              .eq("sender_id", user.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            // Count messages from others after my last message
            let query = supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("match_id", m.id)
              .neq("sender_id", user.id);

            if (myLastMsg) {
              query = query.gt("created_at", myLastMsg.created_at);
            }

            const { count } = await query;
            unreadCount = count ?? 0;
          }

          return {
            ...m,
            otherName: profileRes.data?.first_name ?? undefined,
            feedback: feedbackRes.data ?? undefined,
            unreadCount,
          } as MatchRecord;
        })
      );

      setMatches(enriched);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const active = matches.filter((m) => m.status === "mutual" && !m.feedback);
  const pending = matches.filter((m) => {
    if (m.status !== "pending") return false;
    const isA = m.user_a_id === user!.id;
    return isA ? m.user_a_action === "accept" : m.user_b_action === "accept";
  });
  const past = matches.filter((m) => (m.status === "mutual" && m.feedback) || m.status === "archived" || m.status === "expired");
  const passedCount = matches.filter((m) => m.status?.startsWith("passed")).length;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-10 space-y-6">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Match History</h1>
        <p className="text-xs text-muted-foreground">Keep track of all your mutual connections, pending matches, and past hangouts</p>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 px-1">
            <CheckCircle className="h-4 w-4" /> Active Connections ({active.length})
          </h2>
          {active.map((m) => {
            const otherId = m.user_a_id === user!.id ? m.user_b_id : m.user_a_id;
            return (
              <Card key={m.id} className="rounded-2xl border border-[#EFE8DD] shadow-soft bg-white hover:shadow-card transition-all">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-base font-bold text-foreground truncate">{m.otherName || "Mutual Match"}</p>
                      {(m.unreadCount ?? 0) > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white shadow-2xs">
                          {m.unreadCount} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Connected {formatDate(m.created_at)}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFF0EB] px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      <span>💬 Chat open</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" className="h-9 rounded-full px-3.5 text-xs font-bold shadow-2xs" onClick={() => navigate(`/match/${m.id}/chat`)}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat
                    </Button>
                    <Button size="sm" variant="outline" className="h-9 rounded-full px-3 text-xs font-semibold border-[#EFE8DD]" onClick={() => navigate(`/match-reveal/${m.id}`)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </Button>
                    <MatchActions
                      matchId={m.id}
                      otherUserId={otherId}
                      otherName={m.otherName}
                      onBlocked={() => window.location.reload()}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5 px-1">
            <Clock className="h-4 w-4" /> Pending Acceptance ({pending.length})
          </h2>
          {pending.map((m) => (
            <Card key={m.id} className="rounded-2xl border border-[#EFE8DD] shadow-soft bg-white">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground text-sm">Match • {m.compatibility_score}% Compatible</p>
                  <p className="text-xs text-muted-foreground mt-0.5">You accepted on {formatDate(m.created_at)}</p>
                  <p className="text-xs text-amber-600 font-semibold mt-1">Waiting for them to respond...</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Past */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
            <Star className="h-4 w-4" /> Past Connections
          </h2>
          {past.map((m) => (
            <Card key={m.id} className="rounded-2xl border border-[#EFE8DD] shadow-soft bg-white">
              <CardContent className="p-4">
                <p className="font-serif text-base font-bold text-foreground">{m.otherName || "Match"}</p>
                <p className="text-xs text-muted-foreground">Connected {formatDate(m.created_at)}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="rounded-full text-xs font-semibold">
                    {m.status === "archived" || m.feedback?.met_in_person === "yes"
                      ? "☕ Met in person"
                      : m.status === "expired"
                      ? "⏰ Expired"
                      : "Didn't meet"}
                  </Badge>
                  {m.feedback?.rating && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      {Array.from({ length: m.feedback.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Passed */}
      {passedCount > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
            <XCircle className="h-4 w-4" /> Passed Matches
          </h2>
          <Card className="rounded-2xl border border-[#EFE8DD] bg-[#FAF7F2]">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{passedCount} match proposals passed</p>
              <span className="text-[11px] text-muted-foreground">Kept private</span>
            </CardContent>
          </Card>
        </section>
      )}

      {matches.length === 0 && (
        <Card className="rounded-3xl border border-[#EFE8DD] shadow-card bg-white">
          <CardContent className="py-12 px-6 text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0EB] text-3xl shadow-xs">
              💌
            </div>
            <div className="space-y-1.5">
              <h2 className="font-serif text-2xl font-bold text-foreground">No Match History Yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Ready to find genuine friends or couple companions? Start your first search!
              </p>
            </div>
            <Button className="rounded-full px-8 font-bold h-12 shadow-soft" onClick={() => navigate("/matches")}>
              Find Matches
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default History;
