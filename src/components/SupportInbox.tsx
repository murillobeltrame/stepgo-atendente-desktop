import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  ImagePlus,
  Loader2,
  Send,
  Star,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  claimConversation,
  closeConversation,
  fetchConversation,
  fetchInbox,
  sendMessage,
  uploadAttachment,
} from "@/lib/api";
import type { InboxFilter, PendingAttachment, SupportConversation, SupportMessage } from "@/types";

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
  return (
    <span className="stars">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={12}
          fill={index < rating ? "currentColor" : "none"}
          color={index < rating ? "#f59e0b" : "#cbd5e1"}
        />
      ))}
    </span>
  );
}

function MessageAttachment({ message }: { message: SupportMessage }) {
  if (!message.attachmentUrl) return null;

  if (message.attachmentMimeType?.startsWith("image/")) {
    return (
      <a
        className="attachment-thumb"
        href={message.attachmentUrl}
        target="_blank"
        rel="noreferrer"
      >
        <img src={message.attachmentUrl} alt={message.attachmentFileName ?? "Anexo"} />
      </a>
    );
  }

  return (
    <a
      href={message.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      style={{ display: "inline-block", marginBottom: 8, fontSize: "0.78rem" }}
    >
      📎 {message.attachmentFileName ?? "Anexo"}
    </a>
  );
}

type Props = {
  onQueueUpdate: (waitingCount: number) => void;
};

export function SupportInbox({ onQueueUpdate }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const inboxQuery = useQuery({
    queryKey: ["support-inbox", filter],
    queryFn: () => fetchInbox(filter),
    refetchInterval: filter === "closed" ? false : 4000,
  });

  const conversationQuery = useQuery({
    queryKey: ["support-conversation", selectedId],
    queryFn: () => fetchConversation(selectedId!),
    enabled: Boolean(selectedId),
    refetchInterval: (query) => {
      const status = query.state.data?.conversation?.status;
      if (filter === "closed" || status === "CLOSED") return false;
      return 3000;
    },
  });

  const conversations = inboxQuery.data?.conversations ?? [];
  const selected = conversationQuery.data?.conversation ?? null;
  const currentAdmin = inboxQuery.data?.currentAdmin ?? conversationQuery.data?.currentAdmin;

  const waitingQuery = useQuery({
    queryKey: ["support-waiting-count"],
    queryFn: () => fetchInbox("waiting"),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const count = waitingQuery.data?.conversations.length ?? 0;
    onQueueUpdate(count);
  }, [waitingQuery.data?.conversations.length, onQueueUpdate]);

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !conversations.some((c) => c.id === selectedId)) {
      setSelectedId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selected?.messages?.length, selectedId]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    void qc.invalidateQueries({ queryKey: ["support-waiting-count"] });
    if (selectedId) void qc.invalidateQueries({ queryKey: ["support-conversation", selectedId] });
  };

  const claim = useMutation({
    mutationFn: (id: string) => claimConversation(id),
    onSuccess: () => invalidate(),
  });

  const close = useMutation({
    mutationFn: (id: string) => closeConversation(id),
    onSuccess: (_, id) => {
      setFilter("closed");
      setSelectedId(id);
      invalidate();
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || (!reply.trim() && !pendingAttachment)) return;
      await sendMessage(selectedId, reply.trim(), pendingAttachment ?? undefined);
    },
    onSuccess: () => {
      setReply("");
      setPendingAttachment((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return null;
      });
      invalidate();
    },
  });

  const handlePickAttachment = async (file: File) => {
    if (!selected) return;
    setUploadingAttachment(true);
    try {
      const result = await uploadAttachment(file, selected.storeSlug);
      setPendingAttachment((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          ...result.attachment,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        };
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const canReply = useMemo(() => {
    if (!selected || !currentAdmin) return false;
    if (selected.status === "CLOSED") return false;
    return !selected.assignedAdminId || selected.assignedAdminId === currentAdmin.id;
  }, [selected, currentAdmin]);

  return (
    <div className="inbox-layout">
      <section className="card inbox-sidebar">
        <div className="inbox-sidebar-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Headphones size={16} color="var(--brand-dark)" />
            <strong style={{ fontSize: "0.88rem", color: "var(--brand-dark)" }}>
              Fila de atendimento
            </strong>
          </div>
          <div className="filter-row">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`filter-pill ${filter === item.id ? "active" : ""}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
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
                className={`conversation-item ${selectedId === conversation.id ? "selected" : ""}`}
                onClick={() => setSelectedId(conversation.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
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

      <section className="card inbox-chat">
        {!selected ? (
          <div className="empty-state">Selecione um atendimento para responder.</div>
        ) : (
          <>
            <div className="inbox-chat-header" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--brand-dark)" }}>
                  {selected.storeUserName || "Lojista"} · {selected.storeSlug}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                  {statusLabel(selected.status)}
                  {selected.assignedAdminName
                    ? ` · Atendente: ${selected.assignedAdminName}`
                    : " · Aguardando atendente"}
                </p>
                {selected.rating ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    {renderStars(selected.rating)}
                    {selected.ratingComment ? (
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        “{selected.ratingComment}”
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selected.status !== "CLOSED" && selected.assignedAdminId !== currentAdmin?.id ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={claim.isPending}
                    onClick={() => claim.mutate(selected.id)}
                  >
                    Assumir
                  </button>
                ) : null}
                {selected.status !== "CLOSED" ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={close.isPending}
                    onClick={() => close.mutate(selected.id)}
                  >
                    <XCircle size={14} />
                    Encerrar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="messages">
              {(selected.messages ?? []).map((message) => {
                const role =
                  message.senderType === "SYSTEM"
                    ? "system"
                    : message.senderType === "ADMIN"
                      ? "admin"
                      : "user";

                return (
                  <div key={message.id} className={`message-row ${role}`}>
                    <div className={`message-bubble ${role}`}>
                      {message.senderName ? (
                        <p style={{ margin: "0 0 4px", fontSize: "0.72rem", fontWeight: 600 }}>
                          {message.senderName}
                        </p>
                      ) : null}
                      <MessageAttachment message={message} />
                      {message.body ? <p style={{ margin: 0 }}>{message.body}</p> : null}
                      <p className="message-time">
                        {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {selected.status !== "CLOSED" ? (
              <form
                className="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!canReply) return;
                  replyMutation.mutate();
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handlePickAttachment(file);
                  }}
                />

                {pendingAttachment ? (
                  <div className="pending-attachment">
                    {pendingAttachment.previewUrl ? (
                      <img src={pendingAttachment.previewUrl} alt="" />
                    ) : null}
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {pendingAttachment.fileName}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setPendingAttachment((current) => {
                          if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
                          return null;
                        })
                      }
                    >
                      Remover
                    </button>
                  </div>
                ) : null}

                <div className="composer-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!canReply || uploadingAttachment || replyMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadingAttachment ? <Loader2 size={16} /> : <ImagePlus size={16} />}
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      canReply ? "Digite sua resposta…" : "Assuma o atendimento para responder"
                    }
                    rows={2}
                    disabled={!canReply || replyMutation.isPending}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      (!reply.trim() && !pendingAttachment) ||
                      !canReply ||
                      replyMutation.isPending ||
                      uploadingAttachment
                    }
                  >
                    {replyMutation.isPending ? <Loader2 size={16} /> : <Send size={16} />}
                  </button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
