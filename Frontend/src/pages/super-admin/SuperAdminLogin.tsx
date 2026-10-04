import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { superAdminPost } from "@/lib/superAdminHttp";
import { superAdminTokenStore } from "@/lib/superAdminTokenStore";
import { ShieldCheck, Lock, KeyRound, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<"login" | "2fa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await superAdminPost<{ access: string; refresh: string; user?: { role: string } }>("/auth/login/", {
        email,
        password,
      });

      if (res.user && res.user.role !== "super_admin") {
        setError("Access Denied: Account is not a Super Admin.");
        setLoading(false);
        return;
      }

      // Store initial tokens temporarily for 2FA verification step
      superAdminTokenStore.setTokens(res.access, res.refresh);
      setStep("2fa");
    } catch (err: any) {
      setError(err?.message || err?.data?.detail || "Invalid login credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await superAdminPost<{ access: string; refresh: string }>("/super-admin/auth/verify-2fa/", {
        code: otpCode,
      });
      superAdminTokenStore.setTokens(res.access, res.refresh);
      const from = (location.state as any)?.from?.pathname || "/super-admin/dashboard";
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || err?.data?.detail || "Invalid 2FA verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Super Admin Portal</h1>
          <p className="text-sm text-slate-400">High Privilege System Administration</p>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-300">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "login" ? (
          <form onSubmit={handleInitialLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Super Admin Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="superadmin@edusmart.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus:border-red-500 pl-10"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950 border-slate-800 focus:border-red-500"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-all"
            >
              {loading ? "Authenticating..." : "Continue to 2FA Challenge"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Mandatory Security Verification</p>
              <p className="text-xs text-slate-400">Enter your 6-digit TOTP code (or dev code)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otpCode">2FA Code</Label>
              <div className="relative">
                <Input
                  id="otpCode"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="bg-slate-950 border-slate-800 focus:border-red-500 text-center tracking-widest text-lg font-mono"
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-all"
            >
              {loading ? "Verifying TOTP..." : "Unlock Super Admin Session"}
            </Button>

            <button
              type="button"
              onClick={() => setStep("login")}
              className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors pt-2"
            >
              Switch Account / Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
