/**
 * Cobrar una reserva desde el modo club: efectivo, tarjeta o transferencia en un `Alert`.
 * Lo usan el «Hoy» y la Agenda (2026-10), con la MISMA ruta del panel (que mete el pago a
 * la caja si está abierta).
 */
import { Alert } from "react-native";

import { useToast } from "@/components/Toast";
import { useClubActions } from "@/hooks";
import type { PayMethod } from "@/lib/api";
import { money } from "@/lib/format";

const PAY_METHODS: { method: PayMethod; label: string }[] = [
  { method: "cash", label: "Efectivo" },
  { method: "card", label: "Tarjeta" },
  { method: "transfer", label: "Transferencia" },
];

export type Chargeable = {
  id: number;
  court: string | null;
  start: string;
  end: string;
  customer: string;
  total: string;
  payment_status: string;
};

export function useChargeReservation(orgId: number | null) {
  const toast = useToast();
  const { pay } = useClubActions();

  function ask(r: Chargeable) {
    if (orgId == null) return;
    // Con un pago parcial se cobra solo lo que falta: el total ya no es lo que entra.
    const partial = r.payment_status === "partial";
    Alert.alert(
      partial ? "Cobrar lo que falta" : `Cobrar ${money(r.total)}`,
      `${[r.court, `${r.start}–${r.end}`, r.customer].filter(Boolean).join(" · ")}. ${
        partial ? `Ya hay un pago parcial de los ${money(r.total)}; se cobra el resto` : "Se cobra completa"
      } y entra a la caja si está abierta.`,
      [
        ...PAY_METHODS.map((m) => ({
          text: m.label,
          onPress: () =>
            pay.mutate(
              { orgId, reservationId: r.id, method: m.method },
              {
                onSuccess: () => toast.show(`Cobrada en ${m.label.toLowerCase()}.`),
                onError: (e) => toast.show((e as Error).message || "No se pudo cobrar.", "error"),
              }
            ),
        })),
        { text: "Cancelar", style: "cancel" as const },
      ]
    );
  }

  return { ask, busy: pay.isPending };
}
