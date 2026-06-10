import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { createRef } from "react";

describe("RadioGroup", () => {
  it("renders with radio items", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" data-testid="radio1" />
        <RadioGroupItem value="option2" data-testid="radio2" />
      </RadioGroup>
    );

    expect(screen.getByTestId("radio1")).toBeInTheDocument();
    expect(screen.getByTestId("radio2")).toBeInTheDocument();
  });

  it("allows single selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup onValueChange={onValueChange}>
        <RadioGroupItem value="option1" data-testid="radio1" />
        <RadioGroupItem value="option2" data-testid="radio2" />
      </RadioGroup>
    );

    await user.click(screen.getByTestId("radio1"));
    expect(onValueChange).toHaveBeenCalledWith("option1");

    await user.click(screen.getByTestId("radio2"));
    expect(onValueChange).toHaveBeenCalledWith("option2");
  });

  it("shows selected indicator on active item", () => {
    render(
      <RadioGroup value="option1">
        <RadioGroupItem value="option1" data-testid="radio1" />
        <RadioGroupItem value="option2" data-testid="radio2" />
      </RadioGroup>
    );

    expect(screen.getByTestId("radio1")).toHaveAttribute("data-state", "checked");
    expect(screen.getByTestId("radio2")).toHaveAttribute("data-state", "unchecked");
  });

  it("supports defaultValue for uncontrolled mode", () => {
    render(
      <RadioGroup defaultValue="option2">
        <RadioGroupItem value="option1" data-testid="radio1" />
        <RadioGroupItem value="option2" data-testid="radio2" />
      </RadioGroup>
    );

    expect(screen.getByTestId("radio2")).toHaveAttribute("data-state", "checked");
  });

  it("applies custom className to group", () => {
    render(
      <RadioGroup data-testid="group" className="custom-class">
        <RadioGroupItem value="option1" />
      </RadioGroup>
    );

    expect(screen.getByTestId("group")).toHaveClass("custom-class");
  });

  it("forwards ref to group", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <RadioGroup ref={ref}>
        <RadioGroupItem value="option1" />
      </RadioGroup>
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("RadioGroupItem", () => {
  it("applies base styling", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" data-testid="radio" />
      </RadioGroup>
    );

    const radio = screen.getByTestId("radio");
    expect(radio).toHaveClass("aspect-square");
    expect(radio).toHaveClass("h-4");
    expect(radio).toHaveClass("w-4");
    expect(radio).toHaveClass("rounded-full");
    expect(radio).toHaveClass("border");
  });

  it("supports disabled state", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" data-testid="radio" disabled />
      </RadioGroup>
    );

    expect(screen.getByTestId("radio")).toBeDisabled();
  });

  it("forwards ref to item", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <RadioGroup>
        <RadioGroupItem ref={ref} value="option1" />
      </RadioGroup>
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("applies custom className to item", () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="option1" data-testid="radio" className="custom-class" />
      </RadioGroup>
    );

    expect(screen.getByTestId("radio")).toHaveClass("custom-class");
  });
});

describe("RadioGroup keyboard navigation", () => {
  it("navigates with arrow keys", async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup defaultValue="option1">
        <RadioGroupItem value="option1" data-testid="radio1" />
        <RadioGroupItem value="option2" data-testid="radio2" />
        <RadioGroupItem value="option3" data-testid="radio3" />
      </RadioGroup>
    );

    const radio1 = screen.getByTestId("radio1");
    radio1.focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("radio2")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByTestId("radio3")).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByTestId("radio2")).toHaveFocus();
  });
});
