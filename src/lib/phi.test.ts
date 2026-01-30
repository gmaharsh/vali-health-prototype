import { describe, expect, it } from "vitest";
import { clientLabel } from "@/lib/phi";

describe("phi.clientLabel", () => {
  it("formats FirstName + LastInitial with period", () => {
    expect(clientLabel({ firstName: "Mr", lastInitial: "S" })).toBe("Mr S.");
  });

  it("trims and clamps last initial to one character", () => {
    expect(clientLabel({ firstName: "  Alice ", lastInitial: "  Johnson " })).toBe("Alice J.");
  });

  it("falls back safely when missing", () => {
    expect(clientLabel({ firstName: "", lastInitial: "" })).toBe("Client X.");
  });
});

