import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "./checkbox";
import { createRef } from "react";

describe("Checkbox", () => {
  it("renders unchecked by default", () => {
    render(<Checkbox data-testid="checkbox" />);
    const checkbox = screen.getByTestId("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("toggles checked state on click", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox data-testid="checkbox" onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByTestId("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("shows checkmark when checked", () => {
    render(<Checkbox data-testid="checkbox" checked />);
    const checkbox = screen.getByTestId("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("supports controlled mode with checked prop", () => {
    render(<Checkbox data-testid="checkbox" checked={true} />);
    expect(screen.getByTestId("checkbox")).toHaveAttribute("data-state", "checked");
  });

  it("supports uncontrolled mode with defaultChecked", () => {
    render(<Checkbox data-testid="checkbox" defaultChecked />);
    expect(screen.getByTestId("checkbox")).toHaveAttribute("data-state", "checked");
  });

  it("supports indeterminate state", () => {
    render(<Checkbox data-testid="checkbox" checked="indeterminate" />);
    expect(screen.getByTestId("checkbox")).toHaveAttribute("data-state", "indeterminate");
  });

  it("supports disabled state", () => {
    render(<Checkbox data-testid="checkbox" disabled />);
    const checkbox = screen.getByTestId("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("applies base styling", () => {
    render(<Checkbox data-testid="checkbox" />);
    const checkbox = screen.getByTestId("checkbox");
    expect(checkbox).toHaveClass("peer");
    expect(checkbox).toHaveClass("h-4");
    expect(checkbox).toHaveClass("w-4");
    expect(checkbox).toHaveClass("rounded-sm");
    expect(checkbox).toHaveClass("border");
  });

  it("applies custom className", () => {
    render(<Checkbox data-testid="checkbox" className="custom-class" />);
    expect(screen.getByTestId("checkbox")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Checkbox ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("responds to keyboard Space key", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox data-testid="checkbox" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByTestId("checkbox");
    checkbox.focus();
    await user.keyboard(" ");

    expect(onCheckedChange).toHaveBeenCalled();
  });
});
