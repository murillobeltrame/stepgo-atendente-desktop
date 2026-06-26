import { useQuery } from "@tanstack/react-query";
import { Headphones, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchInbox } from "@/lib/api";
import type { InboxFilter, SupportConversation } from "@/types";

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "Abertos" },
  { id: "waiting", label: "Fila" },
  { id: "mine", label: "Meus" },
  { id: "active", label: "Em atendimento" },
  { id: "closed", label: "Encerrados" },
];

function statusLabel(status: SupportConversation["status"]) {
  if (status === "WAITING") return "Na fila";
  if (status === "ACTIVE") return "Em atendimento";
  return "Encerrado";
}

function renderStars(rating: number | null | undefined) {
  if (!rating) return null;
  return <span className="stars">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}

type Props = {
  onQueueUpdate: (waitingCount: number) => void;
};

export function SupportQueue({ onQueueUpdate }: Props) {
  const [filter, setFilter] = useState<InboxFilter>("all");

  const inboxQuery = useQuery({
    queryKey: ["support-inbox", filter],
    queryFn: () => fetchInbox(filter),
    refetchInterval: filter === "closed" ? false : 4000,
  });

  const waitingQuery = useQuery({
    queryKey: ["support-waiting-count"],
    queryFn: () => fetchInbox("waiting"),
    refetchInterval: 5000,
  });

  const conversations = inboxQuery.data?.conversations ?? [];

  useEffect(() => {
    const count = waitingQuery.data?.conversations.length ?? 0;
    onQueueUpdate(count);
  }, [waitingQuery.data?.conversations.length, onQueueUpdate]);

  const openConversation = (conversation: SupportConversation) => {
    const title = conversation.storeUserName || conversation.storeSlug;
    void window.niveDesktop.openConversation(conversation.id, title);
  };

  return (
    <div className="queue-layout">
      <section className="card inbox-sidebar queue-only">
        <div className="inbox-sidebar-header">
          <div className="queue-section-title">
            <Headphones size={16} color="var(--brand-dark)" />
            <strong>Fila de atendimento</strong>
          </div>
          <p className="queue-section-hint">
            Clique em um atendimento para abrir em uma nova janela.
          </p>
          <div className="filter-row-scroll">
            <div className="filter-row" role="tablist" aria-label="Filtros da fila">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`filter-pill ${filter === item.id ? "active" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="conversation-list">
          {inboxQuery.isLoading ? (
            <div style={{ display: "flex", gap: 8, padding: 12, color: "var(--muted)" }}>
              <Loader2 size={16} className="spin" />
              Carregando fila…
            </div>
          ) : conversations.length === 0 ? (
            <p style={{ padding: 12, color: "var(--muted)", fontSize: "0.85rem" }}>
              Nenhum atendimento nesta visão.
            </p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="conversation-item"
                onClick={() => openConversation(conversation)}
              >
                <div className="conversation-item-top">
                  <div className="conversation-item-main">
                    <p className="conversation-title">
                      {conversation.storeUserName || conversation.storeSlug}
                    </p>
                    <p className="conversation-subtitle">{conversation.storeSlug}</p>
                  </div>
                  {conversation.unreadForAdmin ? <span className="unread-dot" /> : null}
                </div>
                <p className="conversation-preview">{conversation.lastMessagePreview}</p>
                <p className="conversation-meta">
                  {statusLabel(conversation.status)}
                  {filter === "closed" && conversation.closedAt
                    ? ` · ${new Date(conversation.closedAt).toLocaleString("pt-BR")}`
                    : ""}
                  {conversation.assignedAdminName ? ` · ${conversation.assignedAdminName}` : ""}
                  {conversation.rating ? <> · {renderStars(conversation.rating)}</> : null}
                </p>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
