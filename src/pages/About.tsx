import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground">About duogo</h1>

        <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
          <p className="text-lg">We're fixing adult friendship formation.</p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">The Problem</h2>
            <p>Making friends as an adult is broken. Existing apps use dating mechanics (endless swiping, messaging limbo, ghosting) that don't work for friendships.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">Our Solution</h2>
            <p>One match at a time. When a compatible friend is found, both of you are notified. Once you both accept, full profiles and in-app chat are unlocked so you can connect and meet in real life.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">What Makes Us Different</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gender-blind, platonic-only matching</li>
              <li>Solo and couple matching (we're the only ones doing this)</li>
              <li>One match at a time without overwhelm</li>
              <li>Mutual acceptance: profiles and chat stay locked until both say yes</li>
            </ul>
          </section>

          <p className="text-sm font-medium text-[#FF5436]">
            Built with care · Welcoming genuine friendships everywhere
          </p>

          <p className="text-sm">
            Get in touch: <a href="mailto:hello@duogo.ca" className="text-primary hover:underline">hello@duogo.ca</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
