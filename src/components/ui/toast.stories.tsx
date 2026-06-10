import type { Meta, StoryObj } from "@storybook/react";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast";
import { Button } from "./button";
import { CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const meta: Meta<typeof Toast> = {
  title: "UI/Toast",
  component: Toast,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <ToastViewport />
      </ToastProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: "Notification toast component built on Radix UI. Supports auto-dismiss and actions.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  render: () => (
    <Toast open>
      <div className="grid gap-1">
        <ToastTitle>Notification</ToastTitle>
        <ToastDescription>This is a default toast message.</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
  ),
};

export const Success: Story = {
  render: () => (
    <Toast open className="border-success-500">
      <div className="flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-success-500" />
        <div className="grid gap-1">
          <ToastTitle>Success</ToastTitle>
          <ToastDescription>Alert has been resolved successfully.</ToastDescription>
        </div>
      </div>
      <ToastClose />
    </Toast>
  ),
};

export const Error: Story = {
  render: () => (
    <Toast open variant="destructive">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5" />
        <div className="grid gap-1">
          <ToastTitle>Error</ToastTitle>
          <ToastDescription>Failed to quarantine the file. Please try again.</ToastDescription>
        </div>
      </div>
      <ToastClose />
    </Toast>
  ),
};

export const Warning: Story = {
  render: () => (
    <Toast open className="border-warning-500">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning-500" />
        <div className="grid gap-1">
          <ToastTitle>Warning</ToastTitle>
          <ToastDescription>Agent connection is degraded. Some features may be unavailable.</ToastDescription>
        </div>
      </div>
      <ToastClose />
    </Toast>
  ),
};

export const Info: Story = {
  render: () => (
    <Toast open className="border-primary-500">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-primary-500" />
        <div className="grid gap-1">
          <ToastTitle>Information</ToastTitle>
          <ToastDescription>New detection rules are being deployed to all agents.</ToastDescription>
        </div>
      </div>
      <ToastClose />
    </Toast>
  ),
};

export const WithAction: Story = {
  name: "With Action",
  render: () => (
    <Toast open>
      <div className="grid gap-1">
        <ToastTitle>Threat Detected</ToastTitle>
        <ToastDescription>Ransomware detected on WS-001. Immediate action required.</ToastDescription>
      </div>
      <ToastAction altText="View alert">View</ToastAction>
      <ToastClose />
    </Toast>
  ),
};

export const AllTypes: Story = {
  name: "All Types",
  render: () => (
    <div className="space-y-4">
      <Toast open>
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-success-500" />
          <div className="grid gap-1">
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>Operation completed.</ToastDescription>
          </div>
        </div>
      </Toast>
      <Toast open variant="destructive">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5" />
          <div className="grid gap-1">
            <ToastTitle>Error</ToastTitle>
            <ToastDescription>Something went wrong.</ToastDescription>
          </div>
        </div>
      </Toast>
      <Toast open className="border-warning-500">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-500" />
          <div className="grid gap-1">
            <ToastTitle>Warning</ToastTitle>
            <ToastDescription>Please check this.</ToastDescription>
          </div>
        </div>
      </Toast>
    </div>
  ),
};
