import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import { useState } from "react";
import type { VaultState } from "../../bindings";

export interface MasterPasswordModalProps {
  isOpen: boolean;
  vaultState: VaultState;
  hasActiveLockout: boolean;
  lockoutRemainingSeconds?: number;
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  onSetup: (password: string, confirmPassword: string) => void;
  onUnlock: (password: string) => void;
  onLock?: () => void;
  onReset?: () => void;
}

function SetupForm({
  isLoading,
  onSetup,
}: {
  isLoading: boolean;
  onSetup: (p: string, c: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSetup(password, confirmPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="setup-master-password"
          className="block text-xs font-medium text-slate-400 mb-1"
        >
          Master Password
        </label>
        <input
          id="setup-master-password"
          type="password"
          required
          minLength={8}
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="setup-confirm-password"
          className="block text-xs font-medium text-slate-400 mb-1"
        >
          Confirm Password
        </label>
        <input
          id="setup-confirm-password"
          type="password"
          required
          minLength={8}
          placeholder="Repeat master password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex h-[34px] items-center justify-center gap-1.5 rounded-md bg-[#BA7517] hover:bg-[#d97706] text-white text-xs font-semibold shadow disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Lock className="h-3.5 w-3.5" />
        )}
        Create Vault
      </button>
    </form>
  );
}

function UnlockForm({
  isLoading,
  hasActiveLockout,
  onUnlock,
}: {
  isLoading: boolean;
  hasActiveLockout: boolean;
  onUnlock: (p: string) => void;
}) {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUnlock(password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="unlock-master-password"
          className="block text-xs font-medium text-slate-400 mb-1"
        >
          Enter Master Password
        </label>
        <input
          id="unlock-master-password"
          type="password"
          required
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading || hasActiveLockout}
          className="w-full rounded-md border border-[#334155] bg-[#1e293b] px-2.5 py-1.5 text-xs text-slate-200 focus:border-[#185FA5] focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || hasActiveLockout}
        className="w-full flex h-[34px] items-center justify-center gap-1.5 rounded-md bg-[#185FA5] hover:bg-[#2563eb] text-white text-xs font-semibold shadow disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Unlock className="h-3.5 w-3.5" />
        )}
        Unlock Vault
      </button>
    </form>
  );
}

function UnlockedView({ onLock }: { onLock?: () => void }) {
  return (
    <div className="space-y-3 text-center py-2">
      <div className="flex items-center justify-center text-emerald-400">
        <Unlock className="h-8 w-8" />
      </div>
      <p className="text-xs text-slate-300">
        Vault is currently unlocked in memory. KEK encryption key is active.
      </p>
      {onLock ? (
        <button
          type="button"
          onClick={onLock}
          className="flex h-[34px] w-full items-center justify-center gap-1.5 rounded-md border border-[#334155] bg-[#1e293b] text-xs font-medium text-slate-200 hover:bg-[#334155] transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          Lock Vault Now
        </button>
      ) : null}
    </div>
  );
}

export function MasterPasswordModal({
  isOpen,
  vaultState,
  hasActiveLockout,
  lockoutRemainingSeconds,
  isLoading,
  error,
  onClose,
  onSetup,
  onUnlock,
  onLock,
}: MasterPasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <section
        aria-label="Master Password Vault"
        className="flex w-full max-w-sm flex-col rounded-xl border border-[#334155] bg-[#0b0f19] text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] bg-[#0C2D5C] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#38bdf8]" aria-hidden="true" />
            <h2 className="text-sm font-semibold tracking-wide text-blue-100">
              {vaultState === "uninitialized"
                ? "Set Up Credential Vault"
                : vaultState === "locked"
                  ? "Unlock Credential Vault"
                  : "Credential Vault Active"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close vault dialog"
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-md text-slate-300 hover:bg-[#185FA5] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {hasActiveLockout && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-[#451a03] p-2.5 text-xs text-amber-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Cooldown active. Please wait {lockoutRemainingSeconds ?? 30}{" "}
                seconds.
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/50 bg-[#450a0a] p-2.5 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          {vaultState === "uninitialized" && (
            <SetupForm isLoading={isLoading} onSetup={onSetup} />
          )}

          {vaultState === "locked" && (
            <UnlockForm
              isLoading={isLoading}
              hasActiveLockout={hasActiveLockout}
              onUnlock={onUnlock}
            />
          )}

          {vaultState === "unlocked" && <UnlockedView onLock={onLock} />}
        </div>
      </section>
    </div>
  );
}
