import { describe, expect, it } from "bun:test";

import { app } from "./index";

describe("SPA", () => {
  it("returns a response on root path", async () => {
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(await response.text()).toStartWith("<!doctype html>");
  });
  it("returns a response on random path", async () => {
    const randomPath = `${crypto.randomUUID()}`;
    const response = await app.handle(new Request(`http://localhost/${randomPath}`));

    expect(response.status).toBe(200);
    expect(await response.text()).toStartWith("<!doctype html>");
  });
  it("includes x-version header", async () => {
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.headers.get("x-version")).toBe("dev");
  });
});
