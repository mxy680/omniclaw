"use client";

import { User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AccountInfo } from "@/lib/auth";

interface AccountRowProps {
  account: AccountInfo;
  onRevoke: (account: string) => void;
}

export function AccountRow({ account, onRevoke }: AccountRowProps) {
  return (
    <div className="group flex items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-3 transition-colors hover:border-border">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{account.name}</span>
          {account.email && (
            <span className="text-xs text-muted-foreground">
              {account.email}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              account.isExpired ? "bg-red-400" : "bg-emerald-400"
            }`}
          />
          <span
            className={`text-xs font-medium ${
              account.isExpired ? "text-red-400" : "text-emerald-500 dark:text-emerald-400"
            }`}
          >
            {account.isExpired ? "Expired" : "Valid"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onRevoke(account.name)}
          title="Revoke access"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}
