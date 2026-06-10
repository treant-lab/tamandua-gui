import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta: Meta<typeof Checkbox> = {
  title: "UI/Checkbox",
  component: Checkbox,
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
        component: "Checkbox input component built on Radix UI. Supports indeterminate state.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="checked" defaultChecked />
      <Label htmlFor="checked">This is checked</Label>
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="indeterminate" checked="indeterminate" />
      <Label htmlFor="indeterminate">Indeterminate state</Label>
    </div>
  ),
};

export const WithLabel: Story = {
  name: "With Label",
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox id="marketing" />
        <Label htmlFor="marketing">Receive marketing emails</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="security" defaultChecked />
        <Label htmlFor="security">Receive security alerts</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="updates" />
        <Label htmlFor="updates">Receive product updates</Label>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox id="disabled-unchecked" disabled />
        <Label htmlFor="disabled-unchecked" className="text-muted-foreground">Disabled unchecked</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <Label htmlFor="disabled-checked" className="text-muted-foreground">Disabled checked</Label>
      </div>
    </div>
  ),
};

export const FormExample: Story = {
  name: "Form Example",
  render: () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Notification Preferences</h4>
      <div className="space-y-2">
        <div className="flex items-start space-x-2">
          <Checkbox id="email-alerts" defaultChecked />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="email-alerts">Email alerts</Label>
            <p className="text-sm text-muted-foreground">
              Receive email notifications for critical alerts.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <Checkbox id="slack-alerts" defaultChecked />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="slack-alerts">Slack notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified in your Slack workspace.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-2">
          <Checkbox id="sms-alerts" />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="sms-alerts">SMS alerts</Label>
            <p className="text-sm text-muted-foreground">
              Receive SMS for critical incidents only.
            </p>
          </div>
        </div>
      </div>
    </div>
  ),
};
