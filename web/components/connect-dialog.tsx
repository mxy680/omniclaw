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
            onClick={isGemini ? handleGeminiConnect : isGitHub ? handleGitHubConnect : handleGoogleConnect}
            disabled={isGitHub || isGemini ? !token.trim() || loading : !accountName.trim() || loading}
          >
            {loading
              ? isGitHub || isGemini ? "Saving..." : "Redirecting..."
              : isGemini ? "Save API Key" : isGitHub ? "Save Token" : `Sign in with ${providerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
