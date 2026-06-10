import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { createRef } from "react";

describe("Tabs", () => {
  it("renders default tab selected", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  it("switches tab content on click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    await user.click(screen.getByText("Tab 2"));

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });

  it("shows active state on selected trigger", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" data-testid="trigger2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const trigger1 = screen.getByTestId("trigger1");
    expect(trigger1).toHaveAttribute("data-state", "active");
  });

  it("supports controlled mode", () => {
    render(
      <Tabs value="tab2">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });
});

describe("TabsList", () => {
  it("applies container styling", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList data-testid="list">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const list = screen.getByTestId("list");
    expect(list).toHaveClass("inline-flex");
    expect(list).toHaveClass("items-center");
    expect(list).toHaveClass("rounded-md");
    expect(list).toHaveClass("bg-muted");
  });

  it("applies custom className", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList data-testid="list" className="custom-class">
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(screen.getByTestId("list")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Tabs defaultValue="tab1">
        <TabsList ref={ref}>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("TabsTrigger", () => {
  it("applies trigger styling", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveClass("inline-flex");
    expect(trigger).toHaveClass("items-center");
    expect(trigger).toHaveClass("whitespace-nowrap");
    expect(trigger).toHaveClass("rounded-sm");
    expect(trigger).toHaveClass("text-sm");
    expect(trigger).toHaveClass("font-medium");
  });

  it("supports disabled state", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" disabled data-testid="disabled">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const trigger = screen.getByTestId("disabled");
    expect(trigger).toBeDisabled();
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger ref={ref} value="tab1">Tab 1</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("TabsContent", () => {
  it("applies content styling", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" data-testid="content">Content</TabsContent>
      </Tabs>
    );

    const content = screen.getByTestId("content");
    expect(content).toHaveClass("mt-2");
  });

  it("applies custom className", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" data-testid="content" className="custom-class">
          Content
        </TabsContent>
      </Tabs>
    );

    expect(screen.getByTestId("content")).toHaveClass("custom-class");
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent ref={ref} value="tab1">Content</TabsContent>
      </Tabs>
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("Tabs keyboard navigation", () => {
  it("navigates with arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" data-testid="trigger2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3" data-testid="trigger3">Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>
    );

    const trigger1 = screen.getByTestId("trigger1");
    trigger1.focus();
    expect(trigger1).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("trigger2")).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("trigger3")).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByTestId("trigger2")).toHaveFocus();
  });

  it("navigates to first tab with Home key", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab3">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" data-testid="trigger2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3" data-testid="trigger3">Tab 3</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const trigger3 = screen.getByTestId("trigger3");
    trigger3.focus();

    await user.keyboard("{Home}");
    expect(screen.getByTestId("trigger1")).toHaveFocus();
  });

  it("navigates to last tab with End key", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1" data-testid="trigger1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2" data-testid="trigger2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3" data-testid="trigger3">Tab 3</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const trigger1 = screen.getByTestId("trigger1");
    trigger1.focus();

    await user.keyboard("{End}");
    expect(screen.getByTestId("trigger3")).toHaveFocus();
  });
});
