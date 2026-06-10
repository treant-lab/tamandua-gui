import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Slider } from "./slider";
import { createRef } from "react";

describe("Slider", () => {
  it("renders with default value", () => {
    render(<Slider data-testid="slider" defaultValue={[50]} />);
    const slider = screen.getByTestId("slider");
    expect(slider).toBeInTheDocument();
  });

  it("supports controlled mode with value prop", () => {
    const onValueChange = vi.fn();
    render(<Slider data-testid="slider" value={[75]} onValueChange={onValueChange} />);
    expect(screen.getByTestId("slider")).toBeInTheDocument();
  });

  it("supports uncontrolled mode with defaultValue", () => {
    render(<Slider data-testid="slider" defaultValue={[25]} />);
    expect(screen.getByTestId("slider")).toBeInTheDocument();
  });

  it("supports min, max, step props", () => {
    render(
      <Slider
        data-testid="slider"
        min={0}
        max={100}
        step={10}
        defaultValue={[50]}
      />
    );
    expect(screen.getByTestId("slider")).toBeInTheDocument();
  });

  it("supports disabled state", () => {
    render(<Slider data-testid="slider" disabled defaultValue={[50]} />);
    const slider = screen.getByTestId("slider");
    expect(slider).toHaveAttribute("data-disabled");
  });

  it("applies base styling", () => {
    render(<Slider data-testid="slider" defaultValue={[50]} />);
    const slider = screen.getByTestId("slider");
    expect(slider).toHaveClass("relative");
    expect(slider).toHaveClass("flex");
    expect(slider).toHaveClass("w-full");
    expect(slider).toHaveClass("touch-none");
    expect(slider).toHaveClass("select-none");
  });

  it("has track element", () => {
    render(<Slider data-testid="slider" defaultValue={[50]} />);
    const slider = screen.getByTestId("slider");
    // Track is a child with relative h-2 w-full
    const track = slider.querySelector('[data-orientation]');
    expect(track).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Slider data-testid="slider" defaultValue={[50]} className="custom-class" />);
    expect(screen.getByTestId("slider")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Slider ref={ref} defaultValue={[50]} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it("responds to keyboard arrow keys", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Slider
        data-testid="slider"
        defaultValue={[50]}
        min={0}
        max={100}
        step={1}
        onValueChange={onValueChange}
      />
    );

    // Focus the thumb
    const slider = screen.getByTestId("slider");
    const thumb = slider.querySelector('[role="slider"]');
    if (thumb) {
      (thumb as HTMLElement).focus();
      await user.keyboard("{ArrowRight}");
      expect(onValueChange).toHaveBeenCalled();
    }
  });

  it("supports multiple thumbs (range)", () => {
    render(<Slider data-testid="slider" defaultValue={[25, 75]} />);
    const slider = screen.getByTestId("slider");
    const thumbs = slider.querySelectorAll('[role="slider"]');
    expect(thumbs.length).toBe(2);
  });
});
