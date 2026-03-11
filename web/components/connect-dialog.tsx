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
  const isInstagram = providerId === "instagram";
  const isFramer = providerId === "framer";
  const isX = providerId === "x";
  const [projectUrl, setProjectUrl] = useState("");

  async function handleFramerConnect() {
    if (!token.trim() || !projectUrl.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/framer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_url: projectUrl.trim(),
          api_key: token.trim(),
          account: accountName.trim() || "default",
        }),
      });
      if (res.ok) {
        toast.success("Framer credentials saved");
        setOpen(false);
        setToken("");
        setProjectUrl("");
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save credentials");
      }
    } catch {
      toast.error("Failed to save credentials");
    } finally {
      setLoading(false);
    }
  }

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
        body: JSON.stringify({ token: token.trim(), account: accountName.trim() || "default" }),
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
        body: JSON.stringify({ api_key: token.trim(), account: accountName.trim() || "default" }),
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
        body: JSON.stringify({ app_id: token.trim(), account: accountName.trim() || "default" }),
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

  async function handleXConnect() {
    setLoading(true);

    try {
      toast.info("A browser window will open — log in to X (Twitter) there.");
      const res = await fetch("/api/auth/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: accountName.trim() || "default" }),
      });

      if (res.ok) {
        toast.success("X account connected");
        setOpen(false);
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to connect X");
      }
    } catch {
      toast.error("Failed to connect X");
    } finally {
      setLoading(false);
    }
  }

  async function handleInstagramConnect() {
    setLoading(true);

    try {
      toast.info("A browser window will open — log in to Instagram there.");
      const res = await fetch("/api/auth/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: accountName.trim() || "default" }),
      });

      if (res.ok) {
        toast.success("Instagram account connected");
        setOpen(false);
        onConnected?.();
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to connect Instagram");
      }
    } catch {
      toast.error("Failed to connect Instagram");
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
                    : isInstagram
                      ? "A browser window will open for you to log in to Instagram. Your session cookies will be captured automatically."
                      : isX
                        ? "A browser window will open for you to log in to X (Twitter). Your session cookies will be captured automatically."
                        : isFramer
                        ? "Enter your Framer project URL and API key from the project's site settings."
                        : `Enter a name for this account, then sign in with ${providerName}.`}
          </DialogDescription>
        </DialogHeader>

        {isGitHub ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="github-account">Account Name</Label>
              <Input
                id="github-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
            </div>
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
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; token.
                </p>
              )}
            </div>
          </div>
        ) : isGemini ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gemini-account">Account Name</Label>
              <Input
                id="gemini-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
            </div>
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
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; API key.
                </p>
              )}
            </div>
          </div>
        ) : isWolfram ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="wolfram-account">Account Name</Label>
              <Input
                id="wolfram-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
            </div>
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
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; AppID.
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
        ) : isInstagram ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="instagram-account">Account Name</Label>
              <Input
                id="instagram-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
              <p className="text-xs text-muted-foreground">
                A browser window will open. Log in with any method (password, SSO, passkey). Session cookies are captured automatically once you land on Instagram.
              </p>
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; session.
                </p>
              )}
            </div>
          </div>
        ) : isX ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="x-account">Account Name</Label>
              <Input
                id="x-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, work, personal"
              />
              <p className="text-xs text-muted-foreground">
                A browser window will open. Log in with any method (password, SSO, passkey). Session cookies are captured automatically once you land on X.
              </p>
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; session.
                </p>
              )}
            </div>
          </div>
        ) : isFramer ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="framer-account">Account Name</Label>
              <Input
                id="framer-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. default, my-site"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="framer-url">Project URL</Label>
              <Input
                id="framer-url"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://framer.com/projects/Website--aabbccdd1122"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="framer-key">API Key</Label>
              <Input
                id="framer-key"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Framer API key"
              />
              <p className="text-xs text-muted-foreground">
                Find your API key in the project&apos;s Site Settings &rarr; General &rarr; API.
              </p>
              {existingAccounts.includes(accountName.trim()) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This will replace the existing &ldquo;{accountName.trim()}&rdquo; credentials.
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
            onClick={isFramer ? handleFramerConnect : isX ? handleXConnect : isInstagram ? handleInstagramConnect : isLinkedin ? handleLinkedinConnect : isWolfram ? handleWolframConnect : isGemini ? handleGeminiConnect : isGitHub ? handleGitHubConnect : handleGoogleConnect}
            disabled={isFramer ? !token.trim() || !projectUrl.trim() || !accountName.trim() || loading : isGitHub || isGemini || isWolfram ? !token.trim() || !accountName.trim() || loading : !accountName.trim() || loading}
          >
            {loading
              ? isFramer ? "Saving..." : isX ? "Waiting for login..." : isInstagram ? "Waiting for login..." : isLinkedin ? "Waiting for login..." : isGitHub || isGemini || isWolfram ? "Saving..." : "Redirecting..."
              : isFramer ? "Save Credentials" : isX ? "Open X Login" : isInstagram ? "Open Instagram Login" : isLinkedin ? "Open LinkedIn Login" : isWolfram ? "Save AppID" : isGemini ? "Save API Key" : isGitHub ? "Save Token" : `Sign in with ${providerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
