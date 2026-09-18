import { Check, CheckCheck } from "lucide-react";
import type { SupportMessageDeliveryStatus } from "@/types";

const LABEL: Record<SupportMessageDeliveryStatus, string> = {
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida pelo lojista",
};

/** Confirmação de leitura estilo WhatsApp: um risco, dois riscos, dois azuis. */
export function DeliveryTicks({ status }: { status?: SupportMessageDeliveryStatus | null }) {
  if (!status) return null;

  const Icon = status === "SENT" ? Check : CheckCheck;

  return (
    <span
      role="img"
      aria-label={LABEL[status]}
      title={LABEL[status]}
      className="message-ticks"
      style={{ color: status === "READ" ? "#38bdf8" : undefined }}
    >
      <Icon size={13} aria-hidden />
    </span>
  );
}
