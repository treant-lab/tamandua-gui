import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Label } from "./label";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Dropdown selection component built on Radix UI. Supports grouping and search.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="orange">Orange</SelectItem>
        <SelectItem value="grape">Grape</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithPlaceholder: Story = {
  name: "With Placeholder",
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Choose your timezone..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="utc-8">Pacific Time (UTC-8)</SelectItem>
        <SelectItem value="utc-5">Eastern Time (UTC-5)</SelectItem>
        <SelectItem value="utc+0">UTC</SelectItem>
        <SelectItem value="utc+1">Central European Time (UTC+1)</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  name: "With Groups",
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select severity" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Critical</SelectLabel>
          <SelectItem value="critical">Critical - Immediate Action</SelectItem>
          <SelectItem value="high">High - Urgent</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Standard</SelectLabel>
          <SelectItem value="medium">Medium - Normal Priority</SelectItem>
          <SelectItem value="low">Low - Can Wait</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Info</SelectLabel>
          <SelectItem value="info">Informational</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel: Story = {
  name: "With Label",
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="status">Alert Status</Label>
      <Select>
        <SelectTrigger id="status">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="investigating">Investigating</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Disabled select" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="option">Option</SelectItem>
      </SelectContent>
    </Select>
  ),
};
