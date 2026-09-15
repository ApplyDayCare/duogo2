import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last Updated: February 2026</p>

        <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. Eligibility</h2>
            <p>You must be 19 years of age or older to use duogo.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Your Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate information in your profile and quiz</li>
              <li>Meet in safe, public places</li>
              <li>Treat all users with respect</li>
              <li>Report any concerning behaviour</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Our Rights</h2>
            <p>We reserve the right to suspend or terminate accounts that violate our community guidelines or receive multiple reports.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Liability</h2>
            <p>duogo facilitates introductions only. We are not responsible for any interactions that occur offline. Always prioritize your personal safety.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Service</h2>
            <p>This is a free service. We may add premium features in the future but core matching will remain free.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>Questions? Email <a href="mailto:support@friendconnector.app" className="text-primary hover:underline">support@friendconnector.app</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
