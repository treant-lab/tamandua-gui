import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, badgeVariants } from "./badge";

describe("Badge", () => {
  it("renders default variant", () => {
    render(<Badge data-testid="badge">Default</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Default");
  });

  it("renders as span element", () => {
    render(<Badge data-testid="badge">Badge</Badge>);
    expect(screen.getByTestId("badge").tagName.toLowerCase()).toBe("span");
  });

  it("applies base styling", () => {
    render(<Badge data-testid="badge">Badge</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveClass("items-center");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("border");
    expect(badge).toHaveClass("text-xs");
    expect(badge).toHaveClass("font-semibold");
  });

  it("renders default variant with primary color", () => {
    render(<Badge variant="default" data-testid="badge">Info</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-primary");
    expect(badge).toHaveClass("text-primary-foreground");
  });

  it("renders success variant with green color", () => {
    render(<Badge variant="success" data-testid="badge">Success</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-success-500");
    expect(badge).toHaveClass("text-white");
  });

  it("renders warning variant with amber color", () => {
    render(<Badge variant="warning" data-testid="badge">Warning</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-warning-500");
    expect(badge).toHaveClass("text-white");
  });

  it("renders destructive variant with red color", () => {
    render(<Badge variant="destructive" data-testid="badge">Error</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-destructive");
    expect(badge).toHaveClass("text-destructive-foreground");
  });

  it("renders secondary variant with neutral color", () => {
    render(<Badge variant="secondary" data-testid="badge">Secondary</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-secondary");
    expect(badge).toHaveClass("text-secondary-foreground");
  });

  it("renders outline variant with border only", () => {
    render(<Badge variant="outline" data-testid="badge">Outline</Badge>);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("text-foreground");
  });

  it("applies custom className", () => {
    render(<Badge data-testid="badge" className="custom-class">Badge</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("custom-class");
  });

  it("renders children content", () => {
    render(
      <Badge data-testid="badge">
        <span data-testid="icon">*</span>
        Label
      </Badge>
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Label")).toBeInTheDocument();
  });
});

describe("badgeVariants", () => {
  it("exports badgeVariants function", () => {
    expect(typeof badgeVariants).toBe("function");
  });

  it("returns string with class names", () => {
    const classes = badgeVariants({ variant: "default" });
    expect(typeof classes).toBe("string");
    expect(classes.length).toBeGreaterThan(0);
  });

  it("includes base classes in all variants", () => {
    const variants = ["default", "success", "warning", "destructive", "secondary", "outline"] as const;
    variants.forEach((variant) => {
      const classes = badgeVariants({ variant });
      expect(classes).toContain("inline-flex");
      expect(classes).toContain("rounded-full");
    });
  });
});
