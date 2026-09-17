import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import OnboardingProgress from "@/components/OnboardingProgress";
import { ArrowLeft, MapPin, Navigation, CheckCircle2, Loader2 } from "lucide-react";
import { getSignupDraft, updateSignupDraft } from "@/lib/signupState";
import {
  formatCanadianPostalCode,
  detectCityFromPostalCode,
  detectCityFromCoordinates,
  extractPostalCode,
  extractCityName,
} from "@/lib/postalCodeUtils";

const RADIUS_OPTIONS = [
  { value: "5", label: "My neighborhood only", desc: "Within ~5 km (High match priority)" },
  { value: "15", label: "Nearby neighborhoods", desc: "Up to 15 km" },
  { value: "30", label: "Within 30 minutes drive", desc: "Up to 30 km" },
  { value: "60", label: "Across the region", desc: "Up to 60 km" },
];

const Location = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const draft = getSignupDraft();

  const initialPostal = draft.postal_code || extractPostalCode(draft.location_city) || extractPostalCode(profile?.location_city) || "";
  const initialCity = draft.location_city ? extractCityName(draft.location_city) : (profile?.location_city ? extractCityName(profile.location_city) : "");

  const [postalCode, setPostalCode] = useState(initialPostal);
  const [city, setCity] = useState(initialCity);
  const [neighborhood, setNeighborhood] = useState(draft.postal_neighborhood || "");
  const [manualCityMode, setManualCityMode] = useState(!initialPostal && !!initialCity);
  const [radius, setRadius] = useState(
    draft.travel_radius_km !== undefined ? String(draft.travel_radius_km) : "5"
  );
  const [loading, setLoading] = useState(false);
  const [detectingPostal, setDetectingPostal] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [validationNote, setValidationNote] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.location_city) {
      const p = extractPostalCode(profile.location_city);
      const c = extractCityName(profile.location_city);
      if (p) setPostalCode((prev) => prev || p);
      if (c) setCity((prev) => prev || c);
    }
  }, [profile?.location_city]);

  // Auto-detect city whenever postal code changes
  const handlePostalChange = useCallback(async (rawVal: string) => {
    const formatted = formatCanadianPostalCode(rawVal);
    setPostalCode(formatted);
    setValidationNote(null);

    const cleanLength = formatted.replace(/\s+/g, "").length;

    // If at least 3 chars (e.g. M5V, K1P, V6B), attempt detection
    if (cleanLength >= 3) {
      setDetectingPostal(true);
      try {
        const result = await detectCityFromPostalCode(formatted);
        if (result && result.city) {
          setCity(result.city);
          setNeighborhood(result.neighborhood || "");
          setValidationNote(null);
        }
      } catch (err) {
        console.debug("Postal detection error", err);
      } finally {
        setDetectingPostal(false);
      }
    } else if (!manualCityMode) {
      setCity("");
      setNeighborhood("");
    }
  }, [manualCityMode]);

  // Initial detection if postal code was already present
  useEffect(() => {
    if (initialPostal) {
      handlePostalChange(initialPostal);
    }
  }, [initialPostal, handlePostalChange]);

  // Browser Geolocation 1-tap detector
  const handleGpsDetect = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation unsupported",
        description: "Your browser does not support GPS location. Please enter your postal code or city.",
        variant: "destructive",
      });
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await detectCityFromCoordinates(pos.coords.latitude, pos.coords.longitude);
          if (res) {
            setCity(res.city);
            if (res.postalCode) setPostalCode(res.postalCode);
            if (res.neighborhood) setNeighborhood(res.neighborhood);
            setValidationNote(null);
            toast({
              title: "Auto-located via GPS!",
              description: `Located in ${res.city}${res.neighborhood ? ` (${res.neighborhood})` : ""}.`,
            });
          }
        } catch (err) {
          toast({
            title: "Location error",
            description: "Could not resolve city from coordinates. Please enter your location.",
            variant: "destructive",
          });
        } finally {
          setDetectingGps(false);
        }
      },
      () => {
        setDetectingGps(false);
        toast({
          title: "Location access denied",
          description: "Please type your postal code (e.g., M5V 2T6) or city name.",
        });
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPostal = postalCode.trim().toUpperCase();
    const cleanCity = city.trim();

    if (!cleanPostal && !cleanCity) {
      toast({
        title: "Location required",
        description: "Please enter your postal/zip code or city name so we can calculate distance to matches.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    let finalCity = cleanCity;
    let finalNeighborhood = neighborhood;

    if (!finalCity && cleanPostal) {
      const detected = await detectCityFromPostalCode(cleanPostal);
      if (detected && detected.city) {
        finalCity = detected.city;
        finalNeighborhood = detected.neighborhood || "";
        setCity(detected.city);
        setNeighborhood(detected.neighborhood || "");
      } else {
        finalCity = cleanPostal;
      }
    }

    const radiusVal = parseInt(radius || "5", 10);
    const locationString = cleanPostal && finalCity !== cleanPostal 
      ? `${finalCity} · ${cleanPostal}` 
      : (finalCity || cleanPostal);

    updateSignupDraft({
      postal_code: cleanPostal || undefined,
      postal_neighborhood: finalNeighborhood || undefined,
      location_city: locationString,
      travel_radius_km: radiusVal,
    });

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({
          location_city: locationString,
          travel_radius_km: radiusVal,
        })
        .eq("id", user.id);
      setLoading(false);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    setLoading(false);
    navigate("/quiz");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-background flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto space-y-6 flex-1 flex flex-col justify-start">
        <button
          onClick={() => {
            if (draft.user_type === "couple") {
              navigate("/onboarding/couple-setup");
            } else {
              navigate("/onboarding/profile");
            }
          }}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7A746C] hover:text-[#1A1816] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Profile
        </button>

        <OnboardingProgress
          currentStep={draft.user_type === "couple" ? 7 : 6}
          totalSteps={draft.user_type === "couple" ? 7 : 6}
        />

        <Card className="border border-[#EFE8DD] shadow-[0_12px_36px_-6px_rgba(26,24,22,0.06)] rounded-[2rem] bg-white dark:bg-card overflow-hidden">
          <CardHeader className="pt-8 pb-3 px-6 sm:px-8 text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF0EB] border border-[#FFD9CE] text-xs font-bold text-[#FF5436] mb-1 mx-auto">
              <span>Local Proximity Matching</span>
            </div>
            <CardTitle className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1816]">
              Where are you based?
            </CardTitle>
            <p className="text-sm text-[#706A62]">
              Enter your postal code or area to match with people near you
            </p>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8 pt-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Location Input Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#706A62]">
                    {manualCityMode ? "Your Area & Region" : "Postal Code"}
                  </Label>
                  <button
                    type="button"
                    onClick={handleGpsDetect}
                    disabled={detectingGps}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF5436] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    {detectingGps ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting GPS...
                      </>
                    ) : (
                      <>
                        <Navigation className="h-3.5 w-3.5" /> Auto-detect via GPS
                      </>
                    )}
                  </button>
                </div>

                {!manualCityMode ? (
                  <>
                    <div className="relative">
                      <Input
                        type="text"
                        maxLength={10}
                        placeholder="e.g. M5V 2T6 or postal code"
                        value={postalCode}
                        onChange={(e) => handlePostalChange(e.target.value)}
                        className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold tracking-wider uppercase focus-visible:ring-[#FF5436]"
                        autoFocus
                      />
                      {detectingPostal && (
                        <div className="absolute right-3.5 top-3.5 text-[#706A62]">
                          <Loader2 className="h-5 w-5 animate-spin text-[#FF5436]" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-[#706A62]">
                        Instant lookup for postal codes
                      </p>
                      <button
                        type="button"
                        onClick={() => setManualCityMode(true)}
                        className="text-xs font-semibold text-[#FF5436] hover:underline cursor-pointer"
                      >
                        Enter area directly →
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <Input
                      type="text"
                      placeholder="e.g. Neighborhood or area name"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-13 rounded-2xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-4 text-base font-semibold focus-visible:ring-[#FF5436]"
                      autoFocus
                    />
                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        type="text"
                        placeholder="Neighborhood (optional)"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="h-12 rounded-xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-3.5 text-sm"
                      />
                      <Input
                        type="text"
                        placeholder="Postal/ZIP (optional)"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                        className="h-12 rounded-xl border-[#EFE8DD] bg-[#FAF7F2]/60 px-3.5 text-sm font-mono uppercase"
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs text-[#706A62]">
                        Matches strictly stay within your selected radius
                      </p>
                      <button
                        type="button"
                        onClick={() => setManualCityMode(false)}
                        className="text-xs font-semibold text-[#FF5436] hover:underline cursor-pointer"
                      >
                        ← Use postal code
                      </button>
                    </div>
                  </div>
                )}

                {/* Validation Note */}
                {validationNote && (
                  <p className="text-xs text-amber-700 font-medium px-1">
                    {validationNote}
                  </p>
                )}

                {/* Auto-Located Location Card */}
                {city ? (
                  <div className="rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                        <span>Location Confirmed</span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xl font-serif font-bold text-[#14532D]">
                        {city}
                      </h4>
                      {neighborhood && (
                        <p className="text-xs text-[#166534] font-medium flex items-center gap-1.5 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                          <span>{neighborhood}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-[#15803D]/80 border-t border-[#DCFCE7] pt-2 flex items-center justify-between">
                      <span>{postalCode ? `Code: ${postalCode}` : "Active location saved"}</span>
                      <span>Radius matching active</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EFE8DD] text-xs text-[#706A62] text-center">
                    Enter your postal code or area to set your location
                  </div>
                )}
              </div>

              {/* Travel Radius */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#706A62]">
                    How far will you travel for hangouts?
                  </Label>
                  <span className="text-xs text-[#16A34A] font-semibold">5 km default</span>
                </div>
                <RadioGroup value={radius} onValueChange={setRadius} className="space-y-2.5">
                  {RADIUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 p-3.5 sm:p-4 transition-all ${
                        radius === opt.value
                          ? "border-[#FF5436] bg-[#FFF8F5] ring-2 ring-[#FF5436]/20 shadow-2xs"
                          : "border-[#EFE8DD] bg-[#FAF7F2]/60 hover:border-[#DECBBF] hover:bg-white"
                      }`}
                    >
                      <RadioGroupItem value={opt.value} className="text-[#FF5436]" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#1A1816]">{opt.label}</p>
                        </div>
                        <p className="text-xs text-[#706A62]">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Button
                type="submit"
                className="h-13 sm:h-14 w-full text-base font-bold rounded-2xl bg-[#FF5436] hover:bg-[#E84326] text-white shadow-[0_8px_20px_rgba(255,84,54,0.32)] transition-all cursor-pointer"
                disabled={loading || (!postalCode.trim() && !city.trim())}
              >
                {loading ? "Saving..." : "Continue to Lifestyle Quiz →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Location;
