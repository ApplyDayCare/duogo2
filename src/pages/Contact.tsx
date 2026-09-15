import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";

const Contact = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground">Contact Us</h1>
        <p className="mt-2 text-muted-foreground">Questions? Feedback? We'd love to hear from you.</p>

        <Card className="mt-8 border-0 shadow-md">
          <CardContent className="py-8 text-center space-y-4">
            <Mail className="mx-auto h-10 w-10 text-primary" />
            <div>
              <p className="font-semibold text-foreground">Email Us</p>
              <a href="mailto:support@friendconnector.app" className="text-primary hover:underline">
                support@friendconnector.app
              </a>
            </div>
            <p className="text-sm text-muted-foreground">We typically respond within 48 hours.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Contact;
