import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";
import { Label } from "./label";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
  parameters: {
    docs: {
      description: {
        component: "Toggle switch component built on Radix UI. For binary on/off settings.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="checked-switch" defaultChecked />
      <Label htmlFor="checked-switch">Enabled</Label>
    </div>
  ),
};

export const WithLabel: Story = {
  name: "With Label",
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="auto-quarantine">Auto-quarantine</Label>
          <p className="text-sm text-muted-foreground">
            Automatically quarantine detected threats.
          </p>
        </div>
        <Switch id="auto-quarantine" defaultChecked />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="email-notify">Email notifications</Label>
          <p className="text-sm text-muted-foreground">
            Receive email alerts for new threats.
          </p>
        </div>
        <Switch id="email-notify" defaultChecked />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="slack-notify">Slack notifications</Label>
          <p className="text-sm text-muted-foreground">
            Send alerts to your Slack channel.
          </p>
        </div>
        <Switch id="slack-notify" />
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch id="disabled-off" disabled />
        <Label htmlFor="disabled-off" className="text-muted-foreground">Disabled off</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Switch id="disabled-on" disabled defaultChecked />
        <Label htmlFor="disabled-on" className="text-muted-foreground">Disabled on</Label>
      </div>
    </div>
  ),
};

export const SettingsExample: Story = {
  name: "Settings Example",
  render: () => (
    <div className="space-y-6">
      <h4 className="text-sm font-medium">Detection Settings</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>YARA Rules</Label>
            <p className="text-xs text-muted-foreground">Enable YARA rule scanning</p>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Sigma Rules</Label>
            <p className="text-xs text-muted-foreground">Enable Sigma rule detection</p>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>ML Detection</Label>
            <p className="text-xs text-muted-foreground">Enable ML-based threat detection</p>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Behavioral Analysis</Label>
            <p className="text-xs text-muted-foreground">Monitor process behavior (beta)</p>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  ),
};
