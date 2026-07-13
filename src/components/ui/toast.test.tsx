import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./toast";
import { Toaster } from "./toaster";
import { useToast, toast } from "./use-toast";

// Helper component to test useToast hook
function TestToastTrigger({ title, description, variant }: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) {
  const { toast } = useToast();
  return (
    <button
      onClick={() =>
        toast({
          title: title || "Test Title",
          description: description || "Test Description",
          variant,
        })
      }
    >
      Show Toast
    </button>
  );
}

describe("Toast", () => {
  it("renders with title and description", () => {
    render(
      <ToastProvider>
        <Toast data-testid="toast">
          <ToastTitle>Toast Title</ToastTitle>
          <ToastDescription>Toast Description</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByText("Toast Title")).toBeInTheDocument();
    expect(screen.getByText("Toast Description")).toBeInTheDocument();
  });

  it("renders close button", () => {
    render(
      <ToastProvider>
        <Toast data-testid="toast">
          <ToastTitle>Toast</ToastTitle>
          <ToastClose data-testid="close" />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByTestId("close")).toBeInTheDocument();
  });

  it("renders action button", () => {
    render(
      <ToastProvider>
        <Toast>
          <ToastTitle>Toast</ToastTitle>
          <ToastAction altText="Undo action">Undo</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByText("Undo")).toBeInTheDocument();
  });

  it("applies default variant styling", () => {
    render(
      <ToastProvider>
        <Toast data-testid="toast" variant="default">
          <ToastTitle>Default</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId("toast");
    expect(toast).toHaveClass("border");
    expect(toast).toHaveClass("bg-background");
  });

  it("applies destructive variant styling", () => {
    render(
      <ToastProvider>
        <Toast data-testid="toast" variant="destructive">
          <ToastTitle>Error</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    const toast = screen.getByTestId("toast");
    expect(toast).toHaveClass("destructive");
  });

  it("applies custom className", () => {
    render(
      <ToastProvider>
        <Toast data-testid="toast" className="custom-class">
          <ToastTitle>Toast</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );

    expect(screen.getByTestId("toast")).toHaveClass("custom-class");
  });
});

describe("ToastViewport", () => {
  it("renders with fixed positioning", () => {
    render(
      <ToastProvider>
        <ToastViewport data-testid="viewport" />
      </ToastProvider>
    );

    const viewport = screen.getByTestId("viewport");
    expect(viewport).toHaveClass("fixed");
    expect(viewport).toHaveClass("z-[100]");
  });
});

describe("useToast hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns toast function", () => {
    let toastFn: ReturnType<typeof useToast>["toast"] | undefined;

    function TestComponent() {
      const { toast } = useToast();
      toastFn = toast;
      return null;
    }

    render(
      <>
        <TestComponent />
        <Toaster />
      </>
    );

    expect(typeof toastFn).toBe("function");
  });

  it("returns toasts array", () => {
    let toastsArray: ReturnType<typeof useToast>["toasts"] | undefined;

    function TestComponent() {
      const { toasts } = useToast();
      toastsArray = toasts;
      return null;
    }

    render(
      <>
        <TestComponent />
        <Toaster />
      </>
    );

    expect(Array.isArray(toastsArray)).toBe(true);
  });

  it("returns dismiss function", () => {
    let dismissFn: ReturnType<typeof useToast>["dismiss"] | undefined;

    function TestComponent() {
      const { dismiss } = useToast();
      dismissFn = dismiss;
      return null;
    }

    render(
      <>
        <TestComponent />
        <Toaster />
      </>
    );

    expect(typeof dismissFn).toBe("function");
  });
});

describe("toast function", () => {
  it("is exported for programmatic use", () => {
    expect(typeof toast).toBe("function");
  });
});

describe("Toaster integration", () => {
  it("renders toasts when triggered", async () => {
    const user = userEvent.setup();

    render(
      <>
        <TestToastTrigger title="Hello World" />
        <Toaster />
      </>
    );

    await user.click(screen.getByText("Show Toast"));

    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });
  });

  it("shows toast description", async () => {
    const user = userEvent.setup();

    render(
      <>
        <TestToastTrigger description="This is a description" />
        <Toaster />
      </>
    );

    await user.click(screen.getByText("Show Toast"));

    await waitFor(() => {
      expect(screen.getByText("This is a description")).toBeInTheDocument();
    });
  });
});
