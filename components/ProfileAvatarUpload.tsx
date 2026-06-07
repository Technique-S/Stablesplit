"use client";

import { useRef, useState } from "react";
import { compressAndCropImage, readFileAsDataURL } from "@/lib/image-upload";

interface Props {
  currentAvatarURL?: string;
  displayName: string;
  onImageChange: (file: Blob | null) => void;
  onError?: (error: string) => void;
}

export default function ProfileAvatarUpload({ currentAvatarURL, displayName, onImageChange, onError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressAndCropImage(file);
      onImageChange(compressed);
      const dataUrl = await readFileAsDataURL(new File([compressed], "avatar.jpg", { type: "image/jpeg" }));
      setPreview(dataUrl);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to process image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const src = preview || currentAvatarURL;
  const initials = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: 80, height: 80, borderRadius: "50%", flexShrink: 0,
          background: src ? "transparent" : "var(--surface-2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden", position: "relative",
          border: "2px dashed var(--border)",
          transition: "border-color 0.15s ease",
        }}
        title="Upload avatar"
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
      >
        {src ? (
          <img src={src} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
        ) : (
          <span style={{ fontSize: "1.5rem", color: "var(--text-3)", fontWeight: 700 }}>
            {initials}
          </span>
        )}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(0,0,0,0.3)", opacity: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: "0.75rem", fontWeight: 600,
          transition: "opacity 0.15s ease",
        }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
        >
          Upload
        </div>
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>Profile Photo</p>
        <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
          JPG, PNG, or WEBP · Auto-cropped to square
        </p>
        {src && (
          <button
            type="button"
            onClick={handleRemove}
            style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, padding: 0, marginTop: "0.25rem", fontFamily: "DM Sans, sans-serif" }}
          >
            Remove photo
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}