import { describe, it, expect } from "vitest";
import { fone9 } from "./telefone";

describe("fone9", () => {
  it("iguala o número escrito com e sem indicativo", () => {
    expect(fone9("912345678")).toBe("912345678");
    expect(fone9("351912345678")).toBe("912345678");
    expect(fone9("+351 912 345 678")).toBe("912345678");
  });

  it("aguenta lixo sem rebentar", () => {
    expect(fone9("")).toBe("");
    expect(fone9("sem número")).toBe("");
  });
});
