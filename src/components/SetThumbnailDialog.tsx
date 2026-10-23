import { useState, useEffect } from "react";
import { X, Image, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SetThumbnailDialogProps {
  isOpen: boolean;
  imagePath: string;
  onSetThumbnail: (mode: "replace" | "prepend") => void;
  onClose: () => void;
}

export default function SetThumbnailDialog({
  isOpen,
  imagePath,
  onSetThumbnail,
  onClose,
}: SetThumbnailDialogProps) {
  const { t } = useTranslation();
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    setPreviewDataUrl(null);
    setLoadingPreview(true);
    window.api.readImageDataUrl(imagePath).then((result) => {
      if (result.success) setPreviewDataUrl(result.data);
      setLoadingPreview(false);
    });
  }, [imagePath]);

  if (!isOpen) return null;

  const fileName = imagePath.split(/[/\\]/).pop() || imagePath;

  return (
    <div className="fixed inset-0 bg-backdrop flex items-center justify-center z-50">
      <div className="bg-surface border border-border-strong rounded-lg w-full max-w-lg mx-4 shadow-2xl shadow-shadow">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Image size={20} className="text-success" />
            <h2 className="text-lg font-semibold text-foreground">
              {t("dialogs:setThumbnail.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-muted rounded-md cursor-pointer"
          >
            <X size={20} className="text-foreground-muted" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm text-foreground-muted mb-2">
              {t("dialogs:setThumbnail.selectedImage")}
            </p>
            <div className="flex items-center gap-3 p-3 bg-surface-muted/50 rounded-md border border-border-strong">
              <div className="w-16 h-16 bg-surface-muted rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                {loadingPreview ? (
                  <span className="text-xs text-foreground-subtle">
                    {t("dialogs:setThumbnail.loading")}
                  </span>
                ) : previewDataUrl ? (
                  <img 
                    src={previewDataUrl}
                    alt={t("dialogs:setThumbnail.previewAlt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image size={24} className="text-foreground-subtle" />
                )}
              </div>
              <span className="text-sm text-foreground-muted truncate">{fileName}</span>
            </div>
          </div>

          <div>
            <p className="text-sm text-foreground-muted mb-3">
              {t("dialogs:setThumbnail.modePrompt")}
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSetThumbnail("replace")}
                className="flex flex-col items-center p-4 bg-surface-muted hover:bg-surface border-2 border-border-strong hover:border-primary rounded-lg transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="w-14 h-20 bg-surface rounded flex items-center justify-center">
                    <Image size={18} className="text-foreground-subtle" />
                  </div>
                  <ArrowRight size={18} className="text-foreground-subtle" />
                  <div className="w-14 h-20 bg-primary rounded flex items-center justify-center">
                    <Image size={18} className="text-primary-foreground" />
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground group-hover:text-primary">
                  {t("dialogs:setThumbnail.modes.replace")}
                </span>
                <span className="text-xs text-foreground-subtle mt-1 text-center">
                  {t("dialogs:setThumbnail.modes.replaceHint")}
                </span>
              </button>

              <button
                onClick={() => onSetThumbnail("prepend")}
                className="flex flex-col items-center p-4 bg-surface-muted hover:bg-surface border-2 border-border-strong hover:border-primary rounded-lg transition-all cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1 mb-3">
                  <div className="w-14 h-10 bg-primary rounded flex items-center justify-center">
                    <Image size={14} className="text-primary-foreground" />
                  </div>
                  <div className="w-14 h-10 bg-surface rounded flex items-center justify-center">
                    <Image size={14} className="text-foreground-subtle" />
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground group-hover:text-primary">
                  {t("dialogs:setThumbnail.modes.prepend")}
                </span>
                <span className="text-xs text-foreground-subtle mt-1 text-center">
                  {t("dialogs:setThumbnail.modes.prependHint")}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-foreground-muted hover:text-foreground hover:bg-surface-muted rounded-md cursor-pointer"
          >
            {t("dialogs:setThumbnail.actions.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
