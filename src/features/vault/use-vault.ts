import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  commands,
  type VaultState,
  type VaultStatusResponse,
} from "../../bindings";

export interface VaultInfo {
  state: VaultState;
  autoLockTimeoutMinutes: number;
  hasActiveLockout: boolean;
  lockoutRemainingSeconds?: number;
  lastUnlockedAt?: number | null;
  error: string | null;
  isLoading: boolean;
}

const INITIAL_VAULT_INFO: VaultInfo = {
  state: "uninitialized",
  autoLockTimeoutMinutes: 15,
  hasActiveLockout: false,
  error: null,
  isLoading: false,
};

function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function updateStatusData(
  prev: VaultInfo,
  data: VaultStatusResponse,
): VaultInfo {
  return {
    ...prev,
    state: data.state,
    autoLockTimeoutMinutes: data.autoLockTimeoutMinutes,
    hasActiveLockout: data.hasActiveLockout,
    lockoutRemainingSeconds: data.lockoutRemainingSeconds ?? undefined,
    lastUnlockedAt: data.lastUnlockedAt,
    error: null,
  };
}

function setUnlockedState(prev: VaultInfo): VaultInfo {
  return {
    ...prev,
    isLoading: false,
    state: "unlocked",
    error: null,
  };
}

function setErrorState(prev: VaultInfo, message: string): VaultInfo {
  return {
    ...prev,
    isLoading: false,
    error: message,
  };
}

function useSetupVaultAction(
  setVaultState: Dispatch<SetStateAction<VaultInfo>>,
) {
  return useCallback(
    async (password: string, confirmPassword: string): Promise<boolean> => {
      setVaultState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const res = await commands.setupVault({
          clientRequestId: `setup-${Date.now()}`,
          masterPassword: password,
          confirmPassword,
          autoLockTimeoutMinutes: 15,
        });

        if (res.status === "error") {
          setVaultState((prev) => setErrorState(prev, res.error.message));
          return false;
        }

        setVaultState(setUnlockedState);
        return true;
      } catch (err) {
        setVaultState((prev) => setErrorState(prev, formatErrorMessage(err)));
        return false;
      }
    },
    [setVaultState],
  );
}

function useUnlockVaultAction(
  setVaultState: Dispatch<SetStateAction<VaultInfo>>,
) {
  return useCallback(
    async (password: string): Promise<boolean> => {
      setVaultState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const res = await commands.unlockVault({ masterPassword: password });
        if (res.status === "error") {
          setVaultState((prev) => setErrorState(prev, res.error.message));
          return false;
        }

        setVaultState(setUnlockedState);
        return true;
      } catch (err) {
        setVaultState((prev) => setErrorState(prev, formatErrorMessage(err)));
        return false;
      }
    },
    [setVaultState],
  );
}

export function useVault() {
  const [vaultState, setVaultState] = useState<VaultInfo>(INITIAL_VAULT_INFO);

  const checkStatus = useCallback(async () => {
    try {
      const res = await commands.checkVaultStatus();
      if (res.status === "ok") {
        setVaultState((prev) => updateStatusData(prev, res.data));
      }
    } catch (err) {
      setVaultState((prev) => ({ ...prev, error: formatErrorMessage(err) }));
    }
  }, []);

  const setupVault = useSetupVaultAction(setVaultState);
  const unlockVault = useUnlockVaultAction(setVaultState);

  const lockVault = useCallback(async (): Promise<void> => {
    try {
      const res = await commands.lockVault();
      if (res.status === "ok") {
        setVaultState((prev) => ({ ...prev, state: "locked", error: null }));
      }
    } catch (err) {
      setVaultState((prev) => ({ ...prev, error: formatErrorMessage(err) }));
    }
  }, []);

  const resetVault = useCallback(
    async (confirmation: string): Promise<boolean> => {
      try {
        const res = await commands.resetVault({
          confirmationFlag: confirmation,
        });
        if (res.status === "ok") {
          setVaultState((prev) => ({
            ...prev,
            state: "uninitialized",
            error: null,
          }));
          return true;
        }
        return false;
      } catch (err) {
        setVaultState((prev) => ({ ...prev, error: formatErrorMessage(err) }));
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;
    void commands
      .checkVaultStatus()
      .then((res) => {
        if (isMounted && res.status === "ok") {
          setVaultState((prev) => updateStatusData(prev, res.data));
        }
      })
      .catch((err) => {
        if (isMounted) {
          setVaultState((prev) => ({
            ...prev,
            error: formatErrorMessage(err),
          }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    vaultState,
    checkStatus,
    setupVault,
    unlockVault,
    lockVault,
    resetVault,
  };
}
