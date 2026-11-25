import { describe, expect, it } from "vitest";
import { anniversaryPeriod } from "./adminDays";

describe("período de días administrativos (aniversario de ingreso)", () => {
  it("usa el último aniversario anterior o igual a la fecha", () => {
    expect(anniversaryPeriod("2022-03-14", "2026-11-25")).toEqual({ start: "2026-03-14", end: "2027-03-13" });
    expect(anniversaryPeriod("2022-12-10", "2026-11-25")).toEqual({ start: "2025-12-10", end: "2026-12-09" });
  });
  it("el día del aniversario empieza un período nuevo", () => {
    expect(anniversaryPeriod("2022-11-25", "2026-11-25").start).toBe("2026-11-25");
    expect(anniversaryPeriod("2022-11-25", "2026-11-24").start).toBe("2025-11-25");
  });
  it("ingreso el 29 de febrero en años no bisiestos", () => {
    expect(anniversaryPeriod("2020-02-29", "2026-03-01")).toEqual({ start: "2026-02-28", end: "2027-02-27" });
  });
  it("ingreso reciente: el período parte en la fecha de ingreso", () => {
    expect(anniversaryPeriod("2026-06-01", "2026-11-25")).toEqual({ start: "2026-06-01", end: "2027-05-31" });
  });
  it("sin fecha de ingreso usa el año calendario", () => {
    expect(anniversaryPeriod(null, "2026-11-25")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});
