import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Label } from "./label";

const meta: Meta<typeof RadioGroup> = {
  title: "UI/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Radio button group component built on Radix UI. Only one option can be selected at a time.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="option-one">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-one" id="option-one" />
        <Label htmlFor="option-one">Option One</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-two" id="option-two" />
        <Label htmlFor="option-two">Option Two</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="option-three" id="option-three" />
        <Label htmlFor="option-three">Option Three</Label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="low" className="flex space-x-4">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="low" id="low" />
        <Label htmlFor="low">Low</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="medium" id="medium" />
        <Label htmlFor="medium">Medium</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="high" id="high" />
        <Label htmlFor="high">High</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="critical" id="critical" />
        <Label htmlFor="critical">Critical</Label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  name: "With Descriptions",
  render: () => (
    <RadioGroup defaultValue="auto">
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="auto" id="auto" className="mt-1" />
        <div className="grid gap-1.5">
          <Label htmlFor="auto">Automatic</Label>
          <p className="text-sm text-muted-foreground">
            Automatically quarantine detected threats based on risk score.
          </p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="manual" id="manual" className="mt-1" />
        <div className="grid gap-1.5">
          <Label htmlFor="manual">Manual</Label>
          <p className="text-sm text-muted-foreground">
            Require approval for all remediation actions.
          </p>
        </div>
      </div>
      <div className="flex items-start space-x-2">
        <RadioGroupItem value="hybrid" id="hybrid" className="mt-1" />
        <div className="grid gap-1.5">
          <Label htmlFor="hybrid">Hybrid</Label>
          <p className="text-sm text-muted-foreground">
            Auto-quarantine critical threats, require approval for others.
          </p>
        </div>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="enabled">
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="enabled" id="enabled" />
        <Label htmlFor="enabled">Enabled</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="disabled" id="disabled-option" disabled />
        <Label htmlFor="disabled-option" className="text-muted-foreground">Disabled (requires premium)</Label>
      </div>
    </RadioGroup>
  ),
};

export const SeveritySelection: Story = {
  name: "Severity Selection",
  render: () => (
    <div className="space-y-3">
      <Label>Filter by Severity</Label>
      <RadioGroup defaultValue="all" className="space-y-2">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="sev-all" />
          <Label htmlFor="sev-all">All severities</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="critical" id="sev-critical" />
          <Label htmlFor="sev-critical" className="text-error-500">Critical only</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="high-critical" id="sev-high" />
          <Label htmlFor="sev-high" className="text-warning-500">High and Critical</Label>
        </div>
      </RadioGroup>
    </div>
  ),
};
