import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseErrorMessage, withSupabaseTimeout } from "@/lib/supabase-network";
import { logConnectivityError } from "@/lib/network-diagnostics";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in - StudyFlow AI" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pageError = submitError || authError;

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [navigate, session]);

  const requireCredentials = () => {
    if (!email.trim() || !password) {
      const message = "Email and password are required.";
      setSubmitError(message);
      toast.error(message);
      return false;
    }

    return true;
  };

  const handleSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!requireCredentials()) return;
    setLoading(true);
    setSubmitError(null);

    try {
      const { error } = await withSupabaseTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        "Signing in",
      );

      if (error) throw error;
      navigate({ to: "/" });
    } catch (error) {
      logConnectivityError(error);
      const message = getSupabaseErrorMessage(error, "Unable to sign in.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!requireCredentials()) return;
    setLoading(true);
    setSubmitError(null);

    try {
      const { error } = await withSupabaseTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        }),
        "Creating your account",
      );

      if (error) throw error;
      toast.success("Account created. You can sign in now.");
      navigate({ to: "/" });
    } catch (error) {
      logConnectivityError(error);
      const message = getSupabaseErrorMessage(error, "Unable to create your account.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <Card className="bg-surface shadow-card p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="signin">Sign in</TabsTrigger><TabsTrigger value="signup">Sign up</TabsTrigger></TabsList>
            {pageError ? (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{pageError}</AlertDescription>
              </Alert>
            ) : null}
            <TabsContent value="signin" className="space-y-3 pt-4">
              <form className="space-y-3" onSubmit={handleSignIn}>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3 pt-4">
              <form className="space-y-3" onSubmit={signUp}>
                <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
