"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/icons";
import { buildApiPath, getBasePath, withBasePath } from "@/lib/base-path";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function PasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basePath, setBasePath] = useState<string>(() => getBasePath());

  useEffect(() => {
    const resolved = getBasePath();
    if (resolved !== basePath) {
      setBasePath(resolved);
    }
  }, [basePath]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      toast({ variant: "destructive", title: "Missing password" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(buildApiPath("/api/authenticate", basePath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Invalid password");
      }

      const fromParam = searchParams.get("from") || "/";
      const destination = withBasePath(fromParam, basePath);
      router.replace(destination);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Access denied", description: error.message });
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 text-primary">
            <AppLogo className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-headline">Enter Newsroom Password</CardTitle>
            <p className="text-sm text-muted-foreground">
              This portal is restricted. Please enter the shared passphrase.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying
                </>
              ) : (
                "Unlock Newsroom"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Need access? Contact the Ahead team to request the password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
