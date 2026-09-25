import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MasterPasswordModal } from "./MasterPasswordModal";

describe("MasterPasswordModal Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders setup view when vault is uninitialized", () => {
    const onSetup = vi.fn();
    const onClose = vi.fn();

    render(
      <MasterPasswordModal
        isOpen={true}
        vaultState="uninitialized"
        hasActiveLockout={false}
        isLoading={false}
        error={null}
        onClose={onClose}
        onSetup={onSetup}
        onUnlock={() => {}}
      />,
    );

    expect(screen.getByText(/Set Up Credential Vault/i)).toBeVisible();
    expect(screen.getByLabelText(/^Master Password$/i)).toBeVisible();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText(/^Master Password$/i), {
      target: { value: "MyPassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: "MyPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /create vault/i });
    fireEvent.click(submitBtn);

    expect(onSetup).toHaveBeenCalledWith("MyPassword123!", "MyPassword123!");
  });

  it("renders unlock view when vault is locked", () => {
    const onUnlock = vi.fn();

    render(
      <MasterPasswordModal
        isOpen={true}
        vaultState="locked"
        hasActiveLockout={false}
        isLoading={false}
        error={null}
        onClose={() => {}}
        onSetup={() => {}}
        onUnlock={onUnlock}
      />,
    );

    expect(screen.getByText(/Unlock Credential Vault/i)).toBeVisible();
    expect(screen.getByLabelText(/Enter Master Password/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Enter Master Password/i), {
      target: { value: "MyPassword123!" },
    });

    const unlockBtn = screen.getByRole("button", { name: /^unlock vault$/i });
    fireEvent.click(unlockBtn);

    expect(onUnlock).toHaveBeenCalledWith("MyPassword123!");
  });

  it("displays lockout warning when cooldown is active", () => {
    render(
      <MasterPasswordModal
        isOpen={true}
        vaultState="locked"
        hasActiveLockout={true}
        lockoutRemainingSeconds={25}
        isLoading={false}
        error={null}
        onClose={() => {}}
        onSetup={() => {}}
        onUnlock={() => {}}
      />,
    );

    expect(screen.getByText(/Cooldown active/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^unlock vault$/i }),
    ).toBeDisabled();
  });
});
