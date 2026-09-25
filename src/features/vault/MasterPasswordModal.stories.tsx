import type { Meta, StoryObj } from "@storybook/react";
import { MasterPasswordModal } from "./MasterPasswordModal";

const meta: Meta<typeof MasterPasswordModal> = {
  title: "Vault/MasterPasswordModal",
  component: MasterPasswordModal,
  args: {
    isOpen: true,
    vaultState: "uninitialized",
    hasActiveLockout: false,
    isLoading: false,
    error: null,
    onClose: () => {},
    onSetup: () => {},
    onUnlock: () => {},
  },
  parameters: {
    layout: "fullscreen",
    a11y: {
      test: "error",
    },
  },
};

export default meta;
type Story = StoryObj<typeof MasterPasswordModal>;

export const SetupView: Story = {};

export const LockedView: Story = {
  args: {
    vaultState: "locked",
  },
};

export const UnlockedView: Story = {
  args: {
    vaultState: "unlocked",
  },
};

export const CooldownView: Story = {
  args: {
    vaultState: "locked",
    hasActiveLockout: true,
    lockoutRemainingSeconds: 28,
  },
};

export const WithError: Story = {
  args: {
    vaultState: "locked",
    error: "Invalid master password. 2 attempts remaining.",
  },
};
