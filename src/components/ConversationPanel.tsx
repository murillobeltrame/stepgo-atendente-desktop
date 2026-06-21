import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Send, Star, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  claimConversation,
  closeConversation,
  fetchConversation,
  sendMessage,
  uploadAttachment,
} from "@/lib/api";
import type { PendingAttachment, SupportMessage } from "@/types";

function statusLabel(status: "WAITING" | "ACTIVE" | "CLOSED") {
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
  conversationId: string;
};

export function ConversationPanel({ conversationId }: Props) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery({
    queryKey: ["support-conversation", conversationId],
    queryFn: () => fetchConversation(conversationId),
    refetchInterval: (query) => {
      const status = query.state.data?.conversation?.status;
      return status === "CLOSED" ? false : 3000;
    },
  });

  const selected = conversationQuery.data?.conversation ?? null;
  const currentAdmin = conversationQuery.data?.currentAdmin;

  useEffect(() => {
    if (!selected) return;
    const title = `${selected.storeUserName || "Lojista"} · ${selected.storeSlug}`;
    void window.stepgoDesktop.setConversationTitle(title);
  }, [selected?.id, selected?.storeSlug, selected?.storeUserName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selected?.messages?.length, conversationId]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    void qc.invalidateQueries({ queryKey: ["support-waiting-count"] });
    void qc.invalidateQueries({ queryKey: ["support-conversation", conversationId] });
  };

  const claim = useMutation({
    mutationFn: () => claimConversation(conversationId),
    onSuccess: () => invalidate(),
  });

  const close = useMutation({
    mutationFn: () => closeConversation(conversationId),
    onSuccess: () => invalidate(),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!reply.trim() && !pendingAttachment) return;
      await sendMessage(conversationId, reply.trim(), pendingAttachment ?? undefined);
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

  if (conversationQuery.isLoading) {
    return <div className="empty-state">Carregando atendimento…</div>;
  }

  if (!selected) {
    return <div className="empty-state">Atendimento não encontrado.</div>;
  }

  return (
    <div className="conversation-window">
      <div className="inbox-chat-header conversation-window-header">
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
              onClick={() => claim.mutate()}
            >
              Assumir
            </button>
          ) : null}
          {selected.status !== "CLOSED" ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={close.isPending}
              onClick={() => close.mutate()}
            >
              <XCircle size={14} />
              Encerrar
            </button>
          ) : null}
        </div>
      </div>

      <div className="messages conversation-window-messages">
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
              placeholder={canReply ? "Digite sua resposta…" : "Assuma o atendimento para responder"}
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
    </div>
  );
}
