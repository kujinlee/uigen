import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignInAction = vi.fn();
const mockSignUpAction = vi.fn();

vi.mock("@/actions", () => ({
  signIn: (...args: unknown[]) => mockSignInAction(...args),
  signUp: (...args: unknown[]) => mockSignUpAction(...args),
}));

const mockGetAnonWorkData = vi.fn();
const mockClearAnonWork = vi.fn();

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: () => mockGetAnonWorkData(),
  clearAnonWork: () => mockClearAnonWork(),
}));

const mockGetProjects = vi.fn();

vi.mock("@/actions/get-projects", () => ({
  getProjects: () => mockGetProjects(),
}));

const mockCreateProject = vi.fn();

vi.mock("@/actions/create-project", () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}));

const { useAuth } = await import("@/hooks/use-auth");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth", () => {
  describe("initial state", () => {
    it("isLoading is false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("returns signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    it("returns the result from signInAction", async () => {
      const mockResult = { success: false, error: "Invalid credentials" };
      mockSignInAction.mockResolvedValue(mockResult);
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      let returned: unknown;
      await act(async () => {
        returned = await result.current.signIn("a@b.com", "pw");
      });

      expect(returned).toBe(mockResult);
    });

    it("calls signInAction with email and password", async () => {
      mockSignInAction.mockResolvedValue({ success: false });
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "secret");
      });

      expect(mockSignInAction).toHaveBeenCalledWith("user@example.com", "secret");
    });

    it("sets isLoading to false after completion (finally)", async () => {
      mockSignInAction.mockResolvedValue({ success: false });
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pw");
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("sets isLoading to false even when signInAction rejects", async () => {
      mockSignInAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("a@b.com", "pw").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("when result.success is false", () => {
      it("does not call handlePostSignIn", async () => {
        mockSignInAction.mockResolvedValue({ success: false });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("a@b.com", "pw");
        });

        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("when result.success is true", () => {
      describe("handlePostSignIn: anonWork with messages", () => {
        it("creates project from anon work and routes to it", async () => {
          const anonWork = {
            messages: [{ role: "user", content: "hello" }],
            fileSystemData: { "App.jsx": { content: "<div/>" } },
          };
          mockSignInAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(anonWork);
          mockCreateProject.mockResolvedValue({ id: "proj-123" });

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signIn("a@b.com", "pw");
          });

          expect(mockCreateProject).toHaveBeenCalledWith({
            name: expect.stringContaining("Design from"),
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          });
          expect(mockClearAnonWork).toHaveBeenCalled();
          expect(mockPush).toHaveBeenCalledWith("/proj-123");
        });

        it("does not call getProjects when anon work is present", async () => {
          mockSignInAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue({ messages: [{}], fileSystemData: {} });
          mockCreateProject.mockResolvedValue({ id: "x" });

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signIn("a@b.com", "pw");
          });

          expect(mockGetProjects).not.toHaveBeenCalled();
        });
      });

      describe("handlePostSignIn: anonWork is null", () => {
        it("fetches projects and routes to most recent when projects exist", async () => {
          mockSignInAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(null);
          mockGetProjects.mockResolvedValue([{ id: "recent-1" }, { id: "older-2" }]);

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signIn("a@b.com", "pw");
          });

          expect(mockPush).toHaveBeenCalledWith("/recent-1");
          expect(mockCreateProject).not.toHaveBeenCalled();
        });

        it("creates new project and routes to it when no projects exist", async () => {
          mockSignInAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(null);
          mockGetProjects.mockResolvedValue([]);
          mockCreateProject.mockResolvedValue({ id: "new-proj" });

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signIn("a@b.com", "pw");
          });

          expect(mockCreateProject).toHaveBeenCalledWith({
            name: expect.stringContaining("New Design #"),
            messages: [],
            data: {},
          });
          expect(mockPush).toHaveBeenCalledWith("/new-proj");
        });
      });

      describe("handlePostSignIn: anonWork with empty messages", () => {
        it("treats empty messages array as no anon work and falls through to getProjects", async () => {
          mockSignInAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
          mockGetProjects.mockResolvedValue([{ id: "proj-456" }]);

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signIn("a@b.com", "pw");
          });

          expect(mockCreateProject).not.toHaveBeenCalled();
          expect(mockClearAnonWork).not.toHaveBeenCalled();
          expect(mockPush).toHaveBeenCalledWith("/proj-456");
        });
      });
    });
  });

  describe("signUp", () => {
    it("returns the result from signUpAction", async () => {
      const mockResult = { success: false, error: "Email taken" };
      mockSignUpAction.mockResolvedValue(mockResult);
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      let returned: unknown;
      await act(async () => {
        returned = await result.current.signUp("a@b.com", "pw");
      });

      expect(returned).toBe(mockResult);
    });

    it("calls signUpAction with email and password", async () => {
      mockSignUpAction.mockResolvedValue({ success: false });
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("user@example.com", "secret");
      });

      expect(mockSignUpAction).toHaveBeenCalledWith("user@example.com", "secret");
    });

    it("sets isLoading to false after completion (finally)", async () => {
      mockSignUpAction.mockResolvedValue({ success: false });
      mockGetAnonWorkData.mockReturnValue(null);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("a@b.com", "pw");
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("sets isLoading to false even when signUpAction rejects", async () => {
      mockSignUpAction.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("a@b.com", "pw").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("when result.success is false", () => {
      it("does not call handlePostSignIn", async () => {
        mockSignUpAction.mockResolvedValue({ success: false });

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signUp("a@b.com", "pw");
        });

        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    describe("when result.success is true", () => {
      describe("handlePostSignIn: anonWork with messages", () => {
        it("creates project from anon work and routes to it", async () => {
          const anonWork = {
            messages: [{ role: "user", content: "hello" }],
            fileSystemData: { "App.jsx": { content: "<div/>" } },
          };
          mockSignUpAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(anonWork);
          mockCreateProject.mockResolvedValue({ id: "proj-999" });

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signUp("a@b.com", "pw");
          });

          expect(mockCreateProject).toHaveBeenCalledWith({
            name: expect.stringContaining("Design from"),
            messages: anonWork.messages,
            data: anonWork.fileSystemData,
          });
          expect(mockClearAnonWork).toHaveBeenCalled();
          expect(mockPush).toHaveBeenCalledWith("/proj-999");
        });
      });

      describe("handlePostSignIn: anonWork is null", () => {
        it("routes to most recent project when projects exist", async () => {
          mockSignUpAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(null);
          mockGetProjects.mockResolvedValue([{ id: "signup-proj" }]);

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signUp("a@b.com", "pw");
          });

          expect(mockPush).toHaveBeenCalledWith("/signup-proj");
          expect(mockCreateProject).not.toHaveBeenCalled();
        });

        it("creates new project and routes to it when no projects exist", async () => {
          mockSignUpAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue(null);
          mockGetProjects.mockResolvedValue([]);
          mockCreateProject.mockResolvedValue({ id: "brand-new" });

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signUp("a@b.com", "pw");
          });

          expect(mockCreateProject).toHaveBeenCalledWith({
            name: expect.stringContaining("New Design #"),
            messages: [],
            data: {},
          });
          expect(mockPush).toHaveBeenCalledWith("/brand-new");
        });
      });

      describe("handlePostSignIn: anonWork with empty messages", () => {
        it("falls through to getProjects when messages array is empty", async () => {
          mockSignUpAction.mockResolvedValue({ success: true });
          mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
          mockGetProjects.mockResolvedValue([{ id: "proj-789" }]);

          const { result } = renderHook(() => useAuth());
          await act(async () => {
            await result.current.signUp("a@b.com", "pw");
          });

          expect(mockCreateProject).not.toHaveBeenCalled();
          expect(mockClearAnonWork).not.toHaveBeenCalled();
          expect(mockPush).toHaveBeenCalledWith("/proj-789");
        });
      });
    });
  });
});
