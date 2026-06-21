export type SupportMessage = {
  id: string;
  senderType: "USER" | "ADMIN" | "SYSTEM";
  body: string;
  createdAt: string;
  senderName?: string | null;
  attachmentUrl?: string | null;
  attachmentMimeType?: string | null;
  attachmentFileName?: string | null;
};

export type SupportConversation = {
  id: string;
  storeSlug: string;
  storeUserId: string;
  storeUserName: string;
  status: "WAITING" | "ACTIVE" | "CLOSED";
  assignedAdminId: string | null;
  assignedAdminName: string | null;
  rating: number | null;
  ratingComment: string | null;
  closedAt?: string | null;
  lastMessagePreview?: string;
  unreadForAdmin?: boolean;
  messages?: SupportMessage[];
};

export type InboxFilter = "all" | "waiting" | "mine" | "active" | "closed";

export type AdminInfo = {
  id: string;
  name: string;
  email?: string;
};

export type PendingAttachment = {
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  previewUrl?: string;
};

export type AppSettings = {
  apiBaseUrl: string;
  token: string | null;
  adminName: string | null;
  autoStartMinimized: boolean;
  soundEnabled: boolean;
};

declare global {
  interface Window {
    stepgoDesktop: {
      getSettings: () => Promise<AppSettings>;
      setSettings: (partial: Partial<AppSettings>) => Promise<boolean>;
      clearSession: () => Promise<boolean>;
      showApp: () => Promise<boolean>;
      updateQueue: (waitingCount: number) => void;
      onNavigate: (callback: (path: string) => void) => () => void;
    };
  }
}

export {};
