import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACTIVITIES = [
  { id: "coffee", label: "Coffee/drinks" },
  { id: "restaurant", label: "Restaurant/meal" },
  { id: "activity", label: "Activity (hiking, sports, etc.)" },
  { id: "cultural", label: "Cultural (museum, concert, etc.)" },
  { id: "home", label: "Home hangout" },
];

const PulseFeedback = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [metInPerson, setMetInPerson] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [activities, setActivities] = useState<string[]>([]);
  const [activityOther, setActivityOther] = useState("");
  const [otherChecked, setOtherChecked] = useState(false);
  const [wantMore, setWantMore] = useState<string>("");

  // Fetch match info & check for existing feedback
  const { data, isLoading } = useQuery({
    queryKey: ["pulse-feedback", matchId],
    queryFn: async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId!)
        .single();
      if (!match) throw new Error("Match not found");

      const otherId = match.user_a_id === user!.id ? match.user_b_id : match.user_a_id;

      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("first_name, user_type")
        .eq("id", otherId)
        .single();

      // Check couple partner
      let partnerName: string | null = null;
      if (otherProfile?.user_type === "couple") {
        const { data: couple } = await supabase
          .from("couples")
          .select("partner_a_id, partner_b_id")
          .or(`partner_a_id.eq.${otherId},partner_b_id.eq.${otherId}`)
          .maybeSingle();
        if (couple) {
          const pid = couple.partner_a_id === otherId ? couple.partner_b_id : couple.partner_a_id;
          if (pid) {
            const { data: pp } = await supabase
              .from("profiles")
              .select("first_name")
              .eq("id", pid)
              .single();
            partnerName = pp?.first_name ?? null;
          }
        }
      }

      // Check existing feedback
      const { data: existing } = await supabase
        .from("pulse_feedback")
        .select("id")
        .eq("match_id", matchId!)
        .eq("user_id", user!.id)
        .maybeSingle();

      const matchNames = otherProfile?.user_type === "couple" && partnerName
        ? `${otherProfile.first_name || "Partner 1"} & ${partnerName}`
        : otherProfile?.first_name || "Your match";

      return { match, matchNames, alreadySubmitted: !!existing };
    },
    enabled: !!user && !!matchId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const allActivities = [...activities, ...(otherChecked && activityOther.trim() ? [`other:${activityOther.trim()}`] : [])];

      const { error } = await supabase.from("pulse_feedback").insert({
        match_id: matchId!,
        user_id: user!.id,
        met_in_person: metInPerson as "yes" | "planning" | "no",
        rating: metInPerson === "yes" ? rating : null,
        activities: metInPerson === "yes" ? allActivities : null,
        activity_other: metInPerson === "yes" && otherChecked ? activityOther.trim() || null : null,
        want_more_matches: wantMore === "yes",
      });
      if (error) throw error;

      // Apply quality boost for 4-5 star ratings
      if (metInPerson === "yes" && rating >= 4) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("quality_score")
          .eq("id", user!.id)
          .single();
        const current = Number(profile?.quality_score ?? 1);
        await supabase
          .from("profiles")
          .update({ quality_score: Math.round(current * 1.1 * 100) / 100 })
          .eq("id", user!.id);
      }
    },
    onSuccess: () => {
      if (wantMore === "yes") {
        // If high rating, show referral page first
        if (metInPerson === "yes" && rating >= 4) {
          navigate("/referral");
        } else {
          navigate("/matches");
        }
      } else {
        navigate("/pulse/thank-you");
      }
    },
    onError: () => {
      toast({ title: "Error submitting feedback", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data?.alreadySubmitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-lg font-semibold text-foreground">You already submitted feedback for this match.</p>
        <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
      </div>
    );
  }

  if (!data?.match) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 gap-4">
        <p className="text-muted-foreground">Match not found.</p>
        <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
      </div>
    );
  }

  const canSubmit = metInPerson && wantMore && (metInPerson !== "yes" || rating > 0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="space-y-8 py-8">
            <h1 className="text-2xl font-bold text-foreground text-center">
              How did it go with {data.matchNames}?
            </h1>

            {/* Q1: Met in person */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Did you meet in person?</Label>
              <RadioGroup value={metInPerson} onValueChange={setMetInPerson} className="space-y-2">
                {[
                  { value: "yes", label: "Yes, we met up!" },
                  { value: "planning", label: "Not yet, but we're planning to" },
                  { value: "no", label: "No, it didn't work out" },
                ].map((opt) => (
                  <div key={opt.value} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={opt.value} id={`met-${opt.value}`} />
                    <Label htmlFor={`met-${opt.value}`} className="cursor-pointer flex-1 font-normal">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Q2: Rating (conditional) */}
            {metInPerson === "yes" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">How was it?</Label>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-1 transition-transform hover:scale-110"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        className={`h-9 w-9 transition-colors ${
                          star <= (hoverRating || rating)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Q3: Activities (conditional) */}
            {metInPerson === "yes" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">What did you end up doing?</Label>
                <div className="space-y-2">
                  {ACTIVITIES.map((act) => (
                    <div key={act.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`act-${act.id}`}
                        checked={activities.includes(act.id)}
                        onCheckedChange={(checked) =>
                          setActivities((prev) =>
                            checked ? [...prev, act.id] : prev.filter((a) => a !== act.id)
                          )
                        }
                      />
                      <Label htmlFor={`act-${act.id}`} className="cursor-pointer flex-1 font-normal">
                        {act.label}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id="act-other"
                      checked={otherChecked}
                      onCheckedChange={(c) => setOtherChecked(!!c)}
                    />
                    <Label htmlFor="act-other" className="cursor-pointer font-normal">Other:</Label>
                    <Input
                      value={activityOther}
                      onChange={(e) => setActivityOther(e.target.value)}
                      placeholder="What did you do?"
                      className="flex-1 h-8"
                      disabled={!otherChecked}
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Q4: Want more matches */}
            {metInPerson && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Want to find more friends?</Label>
                <RadioGroup value={wantMore} onValueChange={setWantMore} className="space-y-2">
                  {[
                    { value: "yes", label: "Yes, match me again" },
                    { value: "no", label: "No, I'm good for now" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value={opt.value} id={`more-${opt.value}`} />
                      <Label htmlFor={`more-${opt.value}`} className="cursor-pointer flex-1 font-normal">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            <Button
              className="h-12 w-full text-base font-semibold"
              disabled={!canSubmit || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PulseFeedback;
