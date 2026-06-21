import { X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  url: string;
  alt: string;
  onClose: () => void;
};

export function ImageViewer({ url, alt, onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <button
        type="button"
        className="image-viewer-close btn btn-secondary"
        onClick={onClose}
        aria-label="Fechar visualizador"
      >
        <X size={16} />
        Fechar
      </button>
      <img
        className="image-viewer-content"
        src={url}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
