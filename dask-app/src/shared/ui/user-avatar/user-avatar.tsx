import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { cn } from "@/shared/lib/cn";

const acceptedAvatarTypes = ["image/jpeg", "image/png", "image/webp"];

export interface UserAvatarProps {
  alt: string;
  imageUrl?: string | null;
  initials: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  canRemove?: boolean;
  isLoading?: boolean;
  error?: string | null;
  maxSizeBytes?: number;
  onUpload?: (file: File) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${Math.round(value / 1024 / 1024)} MB`;
  }

  return `${Math.round(value / 1024)} KB`;
}

export function UserAvatar({
  alt,
  imageUrl,
  initials,
  className,
  size = "md",
  editable = false,
  canRemove = false,
  isLoading = false,
  error,
  maxSizeBytes = 2 * 1024 * 1024,
  onUpload,
  onRemove
}: UserAvatarProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const visibleError = error ?? localError;
  const shouldShowImage = Boolean(imageUrl) && !imageFailed;

  if (!editable) {
    return (
      <span className={cn("shared-user-avatar", `shared-user-avatar--${size}`, className)}>
        <span className="shared-user-avatar__media" aria-label={alt} role="img">
          {shouldShowImage ? (
            <img
              src={imageUrl ?? undefined}
              alt={alt}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span>{initials}</span>
          )}
        </span>
      </span>
    );
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!acceptedAvatarTypes.includes(file.type)) {
      setLocalError("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > maxSizeBytes) {
      setLocalError(`Use uma imagem de ate ${formatBytes(maxSizeBytes)}.`);
      return;
    }

    setLocalError(null);
    await onUpload?.(file);
  }

  return (
    <div className={cn("shared-user-avatar", `shared-user-avatar--${size}`, editable && "shared-user-avatar--editable", className)}>
      <button
        type="button"
        className="shared-user-avatar__media"
        disabled={isLoading}
        aria-label="Alterar foto de perfil"
        onClick={() => inputRef.current?.click()}
      >
        {shouldShowImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{initials}</span>
        )}
        {isLoading ? <em>Salvando</em> : <small>Alterar</small>}
      </button>

      <div className="shared-user-avatar__actions">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={acceptedAvatarTypes.join(",")}
          className="shared-user-avatar__input"
          onChange={event => void handleFileChange(event)}
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isLoading}>
          Enviar foto
        </button>
        {canRemove ? (
          <button type="button" onClick={() => void onRemove?.()} disabled={isLoading}>
            Remover foto
          </button>
        ) : null}
      </div>

      {visibleError ? <p className="shared-user-avatar__error">{visibleError}</p> : null}
    </div>
  );
}
