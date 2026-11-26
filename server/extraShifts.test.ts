import { describe, expect, it } from "vitest";
import { checkSlot, interval } from "./extraShifts";

const slot = (date: string, shift: "dia" | "tarde" | "noche", startTime: string, hours: number) => ({ date, shift, startTime, hours });

describe("turnos extra: horarios", () => {
  it("la noche que cruza medianoche pertenece a la fecha de inicio", () => {
    const n = interval(slot("2026-11-26", "noche", "20:00", 12));
    const d = interval(slot("2026-11-27", "dia", "08:00", 12));
    expect(n.end).toBe(d.start);
  });

  it("bloquea turnos que se superponen", () => {
    const r = checkSlot(slot("2026-11-26", "tarde", "15:00", 8), [slot("2026-11-26", "dia", "08:00", 12)]);
    expect(r.blocked.length).toBe(1);
  });

  it("advierte 24 horas seguidas (día + noche)", () => {
    const r = checkSlot(slot("2026-11-26", "noche", "20:00", 12), [slot("2026-11-26", "dia", "08:00", 12)]);
    expect(r.blocked).toEqual([]);
    expect(r.warnings[0]).toMatch(/24 horas seguidas/);
  });

  it("advierte poco descanso entre turnos", () => {
    const r = checkSlot(slot("2026-11-27", "tarde", "14:00", 8), [slot("2026-11-26", "noche", "22:00", 12)]);
    expect(r.warnings[0]).toMatch(/descanso/);
  });

  it("turnos con descanso suficiente no generan avisos", () => {
    const r = checkSlot(slot("2026-11-28", "dia", "08:00", 12), [slot("2026-11-26", "dia", "08:00", 12)]);
    expect(r).toEqual({ blocked: [], warnings: [] });
  });
});
