import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVault } from "./use-vault";

vi.mock("../../bindings", () => ({
  commands: {
    checkVaultStatus: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        state: "uninitialized",
        autoLockTimeoutMinutes: 15,
        hasActiveLockout: false,
      },
    }),
    setupVault: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "unlocked",
        vaultCreatedAt: 1727164800000,
        autoLockTimeoutMinutes: 15,
      },
    }),
    unlockVault: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "unlocked",
        unlockedAt: 1727164830000,
        activeAccountCount: 0,
      },
    }),
    lockVault: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "locked",
        lockedAt: 1727164900000,
      },
    }),
    resetVault: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        success: true,
        wipedAt: 1727165000000,
      },
    }),
  },
}));

describe("useVault hook", () => {
  it("initializes with uninitialized state and updates on setup", async () => {
    const { result } = renderHook(() => useVault());

    await act(async () => {
      await result.current.checkStatus();
    });

    expect(result.current.vaultState.state).toBe("uninitialized");

    await act(async () => {
      const ok = await result.current.setupVault(
        "MasterPassword123!",
        "MasterPassword123!",
      );
      expect(ok).toBe(true);
    });

    expect(result.current.vaultState.state).toBe("unlocked");
  });

  it("handles lock and unlock operations", async () => {
    const { result } = renderHook(() => useVault());

    await act(async () => {
      await result.current.lockVault();
    });
    expect(result.current.vaultState.state).toBe("locked");

    await act(async () => {
      const ok = await result.current.unlockVault("MasterPassword123!");
      expect(ok).toBe(true);
    });
    expect(result.current.vaultState.state).toBe("unlocked");
  });
});
