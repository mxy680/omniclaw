"use client";

import { User, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AccountInfo } from "@/lib/auth";

interface AccountRowProps {
  account: AccountInfo;
  onRevoke: (account: string) => void;
}

export function AccountRow({ account, onRevoke }: AccountRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-muted-foreground" />
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
        <Badge
          variant={account.isExpired ? "destructive" : "default"}
          className={
            account.isExpired
              ? ""
              : "bg-green-100 text-green-800 hover:bg-green-100"
          }
        >
          {account.isExpired ? "Expired" : "Valid"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRevoke(account.name)}
          title="Revoke access"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}
