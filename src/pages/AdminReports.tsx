import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, ArrowLeft, Lock } from "lucide-react";

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  match_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter_name?: string;
  reporter_email?: string;
  reported_name?: string;
  reported_email?: string;
}

const ADMIN_PASSWORD_KEY = "admin_auth_token";
const ADMIN_PASSWORD_VALUE_KEY = "admin_password_value";

const AdminReports = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);

  useEffect(() => {
    const storedPassword = sessionStorage.getItem(ADMIN_PASSWORD_VALUE_KEY);
    if (storedPassword) {
      setPassword(storedPassword);
      setAuthed(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadReports();
  }, [authed]);

  const handleLogin = async () => {
    const { data, error } = await supabase.functions.invoke("admin-verify", {
      body: { password },
    });
    if (error || !data?.valid) {
      toast({ title: "Invalid password", variant: "destructive" });
      return;
    }
    sessionStorage.setItem(ADMIN_PASSWORD_VALUE_KEY, password);
    setAuthed(true);
  };

  const loadReports = async () => {
    setLoading(true);
    const storedPassword = sessionStorage.getItem(ADMIN_PASSWORD_VALUE_KEY);
    const { data, error } = await supabase.functions.invoke("admin-reports", {
      body: { action: "list", password: storedPassword },
    });
    if (error) {
      toast({ title: "Error loading reports", variant: "destructive" });
      setLoading(false);
      return;
    }
    setReports(data.reports || []);
    setLoading(false);
  };

  const handleAction = async (action: string, reportId?: string, userId?: string) => {
    const storedPassword = sessionStorage.getItem(ADMIN_PASSWORD_VALUE_KEY);
    await supabase.functions.invoke("admin-reports", {
      body: { action, report_id: reportId, user_id: userId, password: storedPassword },
    });
    toast({ title: action === "suspend" ? "User suspended" : `Report ${action}d` });
    loadReports();
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm border-0 shadow-lg">
          <CardContent className="space-y-4 py-8 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Admin Access</h1>
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button className="w-full" onClick={handleLogin}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "resolved": return "bg-green-100 text-green-800";
      case "dismissed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center gap-3">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">User Reports</h1>
        <Badge variant="secondary">{reports.length}</Badge>
      </div>

      {reports.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No reports yet.</p>
      )}

      {reports.map((r) => (
        <Card key={r.id} className="border-0 shadow-sm">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {r.reporter_name} reported {r.reported_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.reporter_email} → {r.reported_email}
                </p>
              </div>
              <Badge className={statusColor(r.status)}>{r.status}</Badge>
            </div>

            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">Reason: {r.reason}</p>
              {r.details && <p className="text-sm text-muted-foreground">{r.details}</p>}
            </div>

            <p className="text-xs text-muted-foreground">
              Reported {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>

            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => handleAction("suspend", undefined, r.reported_user_id)}>
                  Suspend User
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAction("resolve", r.id)}>
                  Resolve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleAction("dismiss", r.id)}>
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminReports;
