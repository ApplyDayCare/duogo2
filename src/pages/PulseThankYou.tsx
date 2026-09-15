import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PulseThankYou = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="space-y-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Thanks for the feedback! 🙏
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Your input helps us create better matches for everyone.
          </p>
          <Button
            className="h-12 w-full text-base font-semibold"
            onClick={() => navigate("/dashboard")}
          >
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PulseThankYou;
