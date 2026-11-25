import { describe, expect, it } from "vitest";
import { calendarYearPeriod, countAdminDays } from "./adminDays";

describe("días administrativos (año calendario)", () => {
  it("el período es del 1 de enero al 31 de diciembre", () => {
    expect(calendarYearPeriod("2026-11-25")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(calendarYearPeriod("2027-01-01")).toEqual({ start: "2027-01-01", end: "2027-12-31" });
  });

  it("cuenta los usados en el año y en el mes, sin contar el mismo día", () => {
    const used = ["2026-02-10", "2026-11-03", "2026-11-20", "2025-11-15"];
    expect(countAdminDays(used, "2026-11-25")).toEqual({ yearUsed: 3, monthUsed: 2 });
    expect(countAdminDays(used, "2026-11-20")).toEqual({ yearUsed: 2, monthUsed: 1 });
    expect(countAdminDays(used, "2026-12-01")).toEqual({ yearUsed: 3, monthUsed: 0 });
  });

  it("los del año anterior no cuentan", () => {
    expect(countAdminDays(["2025-12-30", "2025-12-31"], "2026-01-02")).toEqual({ yearUsed: 0, monthUsed: 0 });
  });
});
