import { describe, expect, it } from "vitest";
import { assertSafeHttpTarget } from "./security.js";

describe("HTTP runtime target policy", () => {
  it("blocks loopback and private network targets", async () => {
    await expect(assertSafeHttpTarget("http://127.0.0.1:3000")).rejects.toThrow(
      /Private/,
    );
    await expect(assertSafeHttpTarget("http://192.168.1.4")).rejects.toThrow(
      /Private/,
    );
    await expect(assertSafeHttpTarget("http://localhost:3000")).rejects.toThrow(
      /Local network/,
    );
  });

  it("accepts public HTTP targets", async () => {
    await expect(
      assertSafeHttpTarget("https://93.184.216.34/path"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("blocks non-HTTP protocols and embedded credentials", async () => {
    await expect(assertSafeHttpTarget("file:///etc/passwd")).rejects.toThrow(
      /Only http/,
    );
    await expect(
      assertSafeHttpTarget("https://user:secret@example.com"),
    ).rejects.toThrow(/Credentials/);
  });
});
