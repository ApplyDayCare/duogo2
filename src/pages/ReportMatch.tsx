import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";

const REASONS = [
  "Inappropriate behavior",
  "Fake profile / catfishing",
  "Harassment or threats",
  "Spam or scam",
  "Safety concern",
  "Other",
];

const ReportMatch = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !user || !matchId) return;
    setSubmitting(true);

    try {
      // Get the match to find the other user
      const { data: match } = await supabase
        .from("matches")
        .select("user_a_id, user_b_id")
        .eq("id", matchId)
        .single();

      if (!match) throw new Error("Match not found");

      const reportedUserId = match.user_a_id === user.id ? match.user_b_id : match.user_a_id;

      // Insert report
      const { error: reportErr } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        match_id: matchId,
        reason,
        details: details.trim() || null,
        status: "pending",
      });
      if (reportErr) throw reportErr;

      // Block the other user and mark the match as blocked via secure RPC
      // (RLS prevents direct status updates on the matches table.)
      const { error: blockErr } = await supabase.rpc("block_match_user", {
        _other_user_id: reportedUserId,
        _match_id: matchId,
      });
      if (blockErr) throw blockErr;

      toast({
        title: "Report submitted",
        description: "We'll review this within 48 hours. The user has been blocked from your matches.",
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card className="border-0 shadow-lg">
        <CardContent className="space-y-6 py-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Report Match</h1>
              <p className="text-sm text-muted-foreground">
                We take safety seriously. This report is confidential and will be reviewed by our team.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Why are you reporting this match?</p>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REASONS.map((r) => (
                <div key={r} className="flex items-center space-x-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value={r} id={r} />
                  <Label htmlFor={r} className="flex-1 cursor-pointer text-sm">{r}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Additional details (optional)</Label>
            <Textarea
              placeholder="Tell us more about what happened..."
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              className="resize-none"
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!reason || submitting}
              onClick={handleSubmit}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Report
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">After submitting:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• We'll review within 48 hours</li>
              <li>• The other person won't know you reported them</li>
              <li>• They'll be automatically blocked from your matches</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportMatch;
