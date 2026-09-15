import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last Updated: February 2026</p>

        <div className="mt-8 space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address (for login)</li>
              <li>First name (for matching)</li>
              <li>Social media handle (for connection after matching)</li>
              <li>Quiz responses (for compatibility matching)</li>
              <li>Approximate location or postal code (for proximity matching)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What We Don't Do</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>We do <strong className="text-foreground">not</strong> sell your data</li>
              <li>We do <strong className="text-foreground">not</strong> share data with advertisers</li>
              <li>We do <strong className="text-foreground">not</strong> track you across other sites</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data Security</h2>
            <p>Your data is encrypted and stored securely. Your profile and quiz responses are only revealed to matches you mutually accept.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your Rights</h2>
            <p>You can delete your account and all associated data at any time from your profile settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>Questions about your data? Email us at <a href="mailto:privacy@friendconnector.app" className="text-primary hover:underline">privacy@friendconnector.app</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
