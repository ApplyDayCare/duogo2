import { AlertTriangle } from "lucide-react";

const SuspensionBanner = () => (
  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">Your account is under review</p>
      <p className="text-xs text-muted-foreground">
        Matching is temporarily disabled while we review your account. This usually takes up to 48 hours.
      </p>
      <p className="text-xs text-muted-foreground">
        Questions? Email <a href="mailto:support@friendconnector.app" className="text-primary underline">support@friendconnector.app</a>
      </p>
    </div>
  </div>
);

export default SuspensionBanner;
