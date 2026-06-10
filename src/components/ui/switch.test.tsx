import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./switch";
import { createRef } from "react";

describe("Switch", () => {
  it("renders unchecked by default", () => {
    render(<Switch data-testid="switch" />);
    const switchEl = screen.getByTestId("switch");
    expect(switchEl).toBeInTheDocument();
    expect(switchEl).toHaveAttribute("data-state", "unchecked");
  });

  it("toggles on click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch data-testid="switch" onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByTestId("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("shows checked state with primary color", () => {
    render(<Switch data-testid="switch" checked />);
    const switchEl = screen.getByTestId("switch");
    expect(switchEl).toHaveAttribute("data-state", "checked");
  });

  it("supports controlled mode with checked prop", () => {
    render(<Switch data-testid="switch" checked={true} />);
    expect(screen.getByTestId("switch")).toHaveAttribute("data-state", "checked");
  });

  it("supports uncontrolled mode with defaultChecked", () => {
    render(<Switch data-testid="switch" defaultChecked />);
    expect(screen.getByTestId("switch")).toHaveAttribute("data-state", "checked");
  });

  it("supports disabled state", () => {
    render(<Switch data-testid="switch" disabled />);
    const switchEl = screen.getByTestId("switch");
    expect(switchEl).toBeDisabled();
  });

  it("applies base styling", () => {
    render(<Switch data-testid="switch" />);
    const switchEl = screen.getByTestId("switch");
    expect(switchEl).toHaveClass("peer");
    expect(switchEl).toHaveClass("inline-flex");
    expect(switchEl).toHaveClass("h-6");
    expect(switchEl).toHaveClass("w-11");
    expect(switchEl).toHaveClass("rounded-full");
  });

  it("has thumb element", () => {
    render(<Switch data-testid="switch" />);
    const switchEl = screen.getByTestId("switch");
    // Thumb is a child span
    const thumb = switchEl.querySelector("span");
    expect(thumb).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Switch data-testid="switch" className="custom-class" />);
    expect(screen.getByTestId("switch")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Switch ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("responds to keyboard Space key", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch data-testid="switch" onCheckedChange={onCheckedChange} />);

    const switchEl = screen.getByTestId("switch");
    switchEl.focus();
    await user.keyboard(" ");

    expect(onCheckedChange).toHaveBeenCalled();
  });
});
