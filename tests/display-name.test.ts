import { describe, expect, test } from "bun:test";
import { publicDisplayName, safeName } from "../src/lib/display-name";

describe("public display-name privacy", () => {
  const id = "11111111-2222-3333-4444-55555555abcd";
  test("uses the trimmed profile display name", () => {
    expect(publicDisplayName("  Hasin Khan  ", id)).toBe("Hasin Khan");
  });
  test("empty name uses final four user-id characters", () => {
    for (const name of [null, undefined, "", "   "]) {
      expect(publicDisplayName(name, id)).toBe("Axen Member abcd");
    }
  });
  test("email-containing names never reveal address or prefix", () => {
    for (const name of ["private@example.test", "Name <private@example.test>", "@private"]) {
      expect(publicDisplayName(name, id)).toBe("Axen Member abcd");
    }
  });
  test("shared legacy helper rejects emails instead of extracting prefixes", () => {
    expect(safeName("private@example.test", "Partner")).toBe("Partner");
  });
});