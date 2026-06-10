import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
import { createRef } from "react";

describe("Card", () => {
  it("renders as article element", () => {
    render(<Card data-testid="card">Card content</Card>);
    const card = screen.getByTestId("card");
    expect(card.tagName.toLowerCase()).toBe("article");
  });

  it("renders children correctly", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Card data-testid="card" className="custom-class">Card</Card>);
    expect(screen.getByTestId("card")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLElement>();
    render(<Card ref={ref}>Card</Card>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });

  it("applies rounded border and shadow styling", () => {
    render(<Card data-testid="card">Card</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("rounded-lg");
    expect(card).toHaveClass("border");
    expect(card).toHaveClass("shadow-sm");
  });
});

describe("CardHeader", () => {
  it("renders with proper spacing", () => {
    render(<CardHeader data-testid="header">Header</CardHeader>);
    const header = screen.getByTestId("header");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("p-6");
  });

  it("applies custom className", () => {
    render(<CardHeader data-testid="header" className="custom-class">Header</CardHeader>);
    expect(screen.getByTestId("header")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardHeader ref={ref}>Header</CardHeader>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("CardTitle", () => {
  it("renders with heading typography", () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    const title = screen.getByTestId("title");
    expect(title).toHaveClass("text-2xl");
    expect(title).toHaveClass("font-semibold");
    expect(title).toHaveClass("leading-none");
  });

  it("renders as h3 by default", () => {
    render(<CardTitle data-testid="title">Title</CardTitle>);
    expect(screen.getByTestId("title").tagName.toLowerCase()).toBe("h3");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLParagraphElement>();
    render(<CardTitle ref={ref}>Title</CardTitle>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });
});

describe("CardDescription", () => {
  it("renders with muted text", () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>);
    const desc = screen.getByTestId("desc");
    expect(desc).toHaveClass("text-sm");
    expect(desc).toHaveClass("text-muted-foreground");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLParagraphElement>();
    render(<CardDescription ref={ref}>Desc</CardDescription>);
    expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
  });
});

describe("CardContent", () => {
  it("renders with proper padding", () => {
    render(<CardContent data-testid="content">Content</CardContent>);
    const content = screen.getByTestId("content");
    expect(content).toHaveClass("p-6");
    expect(content).toHaveClass("pt-0");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardContent ref={ref}>Content</CardContent>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("CardFooter", () => {
  it("renders with flex layout", () => {
    render(<CardFooter data-testid="footer">Footer</CardFooter>);
    const footer = screen.getByTestId("footer");
    expect(footer).toHaveClass("flex");
    expect(footer).toHaveClass("items-center");
    expect(footer).toHaveClass("p-6");
    expect(footer).toHaveClass("pt-0");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CardFooter ref={ref}>Footer</CardFooter>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("Card composition", () => {
  it("renders all slots together", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
        <CardFooter>Test Footer</CardFooter>
      </Card>
    );

    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByText("Test Footer")).toBeInTheDocument();
  });

  it("allows using CardContent without CardHeader", () => {
    render(
      <Card data-testid="card">
        <CardContent>Just content</CardContent>
      </Card>
    );
    expect(screen.getByText("Just content")).toBeInTheDocument();
  });

  it("allows using CardFooter without other slots", () => {
    render(
      <Card data-testid="card">
        <CardFooter>Just footer</CardFooter>
      </Card>
    );
    expect(screen.getByText("Just footer")).toBeInTheDocument();
  });
});
