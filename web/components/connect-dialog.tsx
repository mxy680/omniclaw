"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConnectDialogProps {
  providerId: string;
  providerName?: string;
  existingAccounts: string[];
  onConnected?: () => void;
}

export function ConnectDialog({
  providerId,
  providerName = "Google",
  existingAccounts,
  onConnected,
}: ConnectDialogProps) {
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("default");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const isGitHub = providerId === "github";
  const isGemini = providerId === "gemini";
  const isWolfram = providerId === "wolfram-alpha";
  const isLinkedin = providerId === "linkedin";

  async function handleGoogleConnect() {
    if (!accountName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/auth/url?account=${encodeURIComponent(accountName.trim())}`,
      );
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  async function handleGitHubConnect() {
    if (!token.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (res.ok) {
        toast.success("GitHub token saved");
        setOpen(false);
        setToken("");
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save token");
      }
    } catch {
      toast.error("Failed to save token");
    } finally {
      setLoading(false);
    }
  }

  async function handleGeminiConnect() {
    if (!token.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: token.trim() }),
      });

      if (res.ok) {
        toast.success("Gemini API key saved");
        setOpen(false);
        setToken("");
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save API key");
      }
    } catch {
      toast.error("Failed to save API key");
    } finally {
      setLoading(false);
    }
  }

  async function handleWolframConnect() {
    if (!token.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/wolfram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: token.trim() }),
      });

      if (res.ok) {
        toast.success("Wolfram Alpha AppID saved");
        setOpen(false);
        setToken("");
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save AppID");
      }
    } catch {
      toast.error("Failed to save AppID");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkedinConnect() {
    setLoading(true);

    try {
      toast.info("A browser window will open — log in to LinkedIn there.");
      const res = await fetch("/api/auth/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: accountName.trim() || "default" }),
      });

      if (res.ok) {
        toast.success("LinkedIn account connected");
        setOpen(false);
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to connect LinkedIn");
      }
    } catch {
      toast.error("Failed to connect LinkedIn");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Connect Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {providerName} Account</DialogTitle>
          <DialogDescription>
            {isGitHub
              ? "Enter a GitHub Personal Access Token (PAT) with the scopes you need."
              : isGemini
                ? "Enter a Gemini API key from Google AI Studio."
                : isWolfram
                  ? "Enter a Wolfram Alpha AppID from the Developer Portal."
                  : isLinkedin
                    ? "A browser window will open for you to log in to LinkedIn. Your session cookies will be captured automatically."
                    : `Enter a name for this account, then sign in with ${providerName}.`}
          </DialogDescription>
        </DialogHeader>

        {isGitHub ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="github-token">Personal Access Token</Label>
              <Input
                id="github-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
              />
              <p className="text-xs text-muted-foreground">
                Create a token at{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  github.com/settings/tokens
                </a>
              </p>
              {existingAccounts.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing token.
                </p>
              )}
            </div>
          </div>
        ) : isGemini ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gemini-key">API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="AIza..."
              />
              <p className="text-xs text-muted-foreground">
                Get an API key at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
              {existingAccounts.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing API key.
                </p>
              )}
            </div>
          </div>
        ) : isWolfram ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="wolfram-appid">AppID</Label>
              <Input
                id="wolfram-appid"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="XXXXXX-XXXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Get an AppID at{" "}
                <a
                  href="https://developer.wolframalpha.com/access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  developer.wolframalpha.com
                </a>
              </p>
              {existingAccounts.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing AppID.
                </p>
              )}
            </div>
          </div>
        ) : isLinkedin ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="linkedin-account">Account Name</Label>
              <Input
                id="linkedin-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
              <p className="text-xs text-muted-foreground">
                A browser window will open. Log in with any method (password, SSO, passkey). Session cookies are captured automatically once you land on LinkedIn.
              </p>
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; session.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; account.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={isLinkedin ? handleLinkedinConnect : isWolfram ? handleWolframConnect : isGemini ? handleGeminiConnect : isGitHub ? handleGitHubConnect : handleGoogleConnect}
            disabled={isGitHub || isGemini || isWolfram ? !token.trim() || loading : !accountName.trim() || loading}
          >
            {loading
              ? isLinkedin ? "Waiting for login..." : isGitHub || isGemini || isWolfram ? "Saving..." : "Redirecting..."
              : isLinkedin ? "Open LinkedIn Login" : isWolfram ? "Save AppID" : isGemini ? "Save API Key" : isGitHub ? "Save Token" : `Sign in with ${providerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
