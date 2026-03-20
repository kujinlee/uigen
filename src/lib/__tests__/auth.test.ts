// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("../auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

const WRONG_SECRET = new TextEncoder().encode("wrong-secret-key");

async function makeToken(payload: object, expiresAt: Date | string = "7d", secret = JWT_SECRET) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt instanceof Date ? Math.floor(expiresAt.getTime() / 1000) : expiresAt)
    .setIssuedAt()
    .sign(secret);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession
test("createSession sets an httpOnly cookie with a JWT", async () => {
  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, token, options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3); // valid JWT structure
  expect(options.httpOnly).toBe(true);
  expect(options.path).toBe("/");
});

test("createSession sets cookie expiry ~7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiresAt = options.expires as Date;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// getSession
test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns session payload for a valid token", async () => {
  const payload = {
    userId: "user-1",
    email: "user@example.com",
    expiresAt: new Date(),
  };
  const token = await makeToken(payload);
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for an expired token", async () => {
  const pastDate = new Date(Date.now() - 1000);
  const token = await makeToken({ userId: "user-1", email: "a@b.com" }, pastDate);
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });

  const session = await getSession();
  expect(session).toBeNull();
});

// deleteSession
test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// verifySession
test("verifySession returns null when no cookie in request", async () => {
  const req = new NextRequest("http://localhost/");

  const session = await verifySession(req);
  expect(session).toBeNull();
});

test("verifySession returns session payload for a valid token in request", async () => {
  const payload = { userId: "user-2", email: "b@b.com", expiresAt: new Date() };
  const token = await makeToken(payload);
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(req);
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("b@b.com");
});

test("verifySession returns null for an invalid token in request", async () => {
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: "auth-token=invalid.token.here" },
  });

  const session = await verifySession(req);
  expect(session).toBeNull();
});

// 5. Expired and malformed tokens
test("verifySession returns null for an expired token in request", async () => {
  const token = await makeToken({ userId: "u1", email: "a@b.com" }, new Date(Date.now() - 1000));
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(req);
  expect(session).toBeNull();
});

// 6. Different payload structures
test("getSession handles special characters in email", async () => {
  const token = await makeToken({ userId: "u1", email: "user+tag@example.co.uk", expiresAt: new Date() });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.email).toBe("user+tag@example.co.uk");
});

test("getSession handles numeric-looking userId", async () => {
  const token = await makeToken({ userId: "1234567890", email: "a@b.com", expiresAt: new Date() });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("1234567890");
});

// 7. JWT secret consistency
test("createSession produces a token verifiable with the same secret", async () => {
  await createSession("user-1", "user@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("getSession returns null for a token signed with a different secret", async () => {
  const token = await makeToken({ userId: "u1", email: "a@b.com" }, "7d", WRONG_SECRET);
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session).toBeNull();
});

test("verifySession returns null for a token signed with a different secret", async () => {
  const token = await makeToken({ userId: "u1", email: "a@b.com" }, "7d", WRONG_SECRET);
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(req);
  expect(session).toBeNull();
});

// 8. Async operations
test("getSession resolves to null (not throws) when cookie store returns undefined", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  await expect(getSession()).resolves.toBeNull();
});

test("deleteSession resolves without throwing", async () => {
  await expect(deleteSession()).resolves.not.toThrow();
});

// 9. Error handling
test("getSession returns null when cookie value is an empty string", async () => {
  mockCookieStore.get.mockReturnValue({ value: "" });

  const session = await getSession();
  expect(session).toBeNull();
});

test("verifySession returns null when cookie value is an empty string", async () => {
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: "auth-token=" },
  });

  const session = await verifySession(req);
  expect(session).toBeNull();
});

// 10. Cookie identification
test("getSession reads from the auth-token cookie specifically", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  await getSession();

  expect(mockCookieStore.get).toHaveBeenCalledWith("auth-token");
});

// 11. Type preservation
test("getSession returns userId and email as strings", async () => {
  const token = await makeToken({ userId: "u1", email: "a@b.com", expiresAt: new Date() });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(typeof session?.userId).toBe("string");
  expect(typeof session?.email).toBe("string");
});

test("verifySession returns userId and email as strings", async () => {
  const token = await makeToken({ userId: "u2", email: "b@b.com", expiresAt: new Date() });
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(req);
  expect(typeof session?.userId).toBe("string");
  expect(typeof session?.email).toBe("string");
});
