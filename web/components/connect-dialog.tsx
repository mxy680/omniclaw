"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  providerName?: string;
  existingAccounts: string[];
}

export function ConnectDialog({ providerName = "Google", existingAccounts }: ConnectDialogProps) {
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("default");
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
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
            Enter a name for this account, then sign in with {providerName}.
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter>
          <Button
            onClick={handleConnect}
            disabled={!accountName.trim() || loading}
          >
            {loading ? "Redirecting..." : `Sign in with ${providerName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
