import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, Phone, ArrowLeft } from "lucide-react";

const Safety = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Safety Guidelines</h1>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Meeting for the First Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>✓ Meet in a public place</p>
          <p>✓ Tell a friend where you're going</p>
          <p>✓ Keep your phone charged</p>
          <p>✓ Trust your gut: it's OK to cancel if something feels off</p>
          <p>✓ Don't share your home address until you feel comfortable</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Before Meeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>✓ Check their social media</p>
          <p>✓ Video chat first (optional)</p>
          <p>✓ Suggest a daytime meeting first</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Red Flags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>🚩 Pressuring you to meet alone</p>
          <p>🚩 Asking for money</p>
          <p>🚩 Inconsistent information</p>
          <p>🚩 Refusing to video chat</p>
          <p>🚩 Aggressive or inappropriate messages</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">If Something Feels Wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Report them immediately</p>
          <p>• Block them from your matches</p>
          <p>• Tell a friend or authority</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-destructive" /> Emergency
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>If you're in immediate danger, call <strong className="text-foreground">911</strong></p>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );
};

export default Safety;
