import type { Meta, StoryObj } from "@storybook/react";
import { Slider } from "./slider";
import { Label } from "./label";
import * as React from "react";

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    step: {
      control: "number",
    },
    min: {
      control: "number",
    },
    max: {
      control: "number",
    },
  },
  parameters: {
    docs: {
      description: {
        component: "Range slider component built on Radix UI. Supports single value and range selection.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: () => (
    <Slider defaultValue={[50]} max={100} step={1} className="w-[300px]" />
  ),
};

export const Range: Story = {
  render: () => (
    <div className="space-y-4">
      <Label>Risk Score Range</Label>
      <Slider defaultValue={[25, 75]} max={100} step={1} className="w-[300px]" />
      <p className="text-sm text-muted-foreground">
        Filter alerts between 25 and 75 risk score
      </p>
    </div>
  ),
};

export const WithSteps: Story = {
  name: "With Steps",
  render: () => (
    <div className="space-y-4">
      <Label>Sensitivity Level</Label>
      <Slider defaultValue={[50]} max={100} step={25} className="w-[300px]" />
      <div className="flex justify-between text-xs text-muted-foreground w-[300px]">
        <span>Low</span>
        <span>Med-Low</span>
        <span>Medium</span>
        <span>Med-High</span>
        <span>High</span>
      </div>
    </div>
  ),
};

export const WithValue: Story = {
  name: "With Value Display",
  render: function Render() {
    const [value, setValue] = React.useState([33]);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Auto-quarantine Threshold</Label>
          <span className="text-sm font-medium">{value[0]}%</span>
        </div>
        <Slider
          value={value}
          onValueChange={setValue}
          max={100}
          step={1}
          className="w-[300px]"
        />
        <p className="text-sm text-muted-foreground">
          Automatically quarantine threats with risk score above {value[0]}%
        </p>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-2">
      <Label className="text-muted-foreground">Disabled Slider</Label>
      <Slider defaultValue={[50]} max={100} disabled className="w-[300px]" />
    </div>
  ),
};

export const ScanDepthExample: Story = {
  name: "Scan Depth Example",
  render: function Render() {
    const [depth, setDepth] = React.useState([3]);
    const depthLabels = ["Minimal", "Light", "Standard", "Deep", "Full"];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Scan Depth</Label>
          <span className="text-sm font-medium">{depthLabels[depth[0]]}</span>
        </div>
        <Slider
          value={depth}
          onValueChange={setDepth}
          max={4}
          step={1}
          className="w-[300px]"
        />
        <div className="flex justify-between text-xs text-muted-foreground w-[300px]">
          {depthLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {depth[0] === 0 && "Quick scan of common threat locations"}
          {depth[0] === 1 && "Scan running processes and startup items"}
          {depth[0] === 2 && "Standard full system scan"}
          {depth[0] === 3 && "Deep scan including memory and registry"}
          {depth[0] === 4 && "Full forensic scan with file carving"}
        </p>
      </div>
    );
  },
};
