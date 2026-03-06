import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/changelog/route";

describe("changelog route", () => {
  it("serves markdown instead of an HTML document", async () => {
    const response = await GET();
    const contentType = response.headers.get("content-type");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(contentType).toContain("text/markdown");
    expect(body).toContain("##");
    expect(body).not.toContain("<!DOCTYPE html>");
    expect(body).not.toContain("<html");
  });
});
