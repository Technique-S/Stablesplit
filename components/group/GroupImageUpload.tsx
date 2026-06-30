"use client";

import { useRef, useState } from "react";
import { compressAndCropImage, readFileAsDataURL } from "@/lib/client/image-upload";

interface Props {
  groupName: string;
  currentPhotoURL?: string;
  onImageChange: (file: Blob | null) => void;
  onError?: (error: string) => void;
}

export default function GroupImageUpload({ groupName, currentPhotoURL, onImageChange, onError }: Props) {
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

  const src = preview || currentPhotoURL;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <div
        onClick={() => fileInputRef.current?.click()}
        className="img-upload-trigger"
        style={{
          width: 64, height: 64, borderRadius: 14, flexShrink: 0,
          background: src ? "transparent" : "var(--surface-2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden", position: "relative",
          border: "2px dashed var(--border)",
          transition: "border-color 0.15s ease",
        }}
        title="Upload group image"
      >
        {src ? (
          <img src={src} alt="Group" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
        ) : (
          <span style={{ fontSize: "1.25rem", color: "var(--text-3)", fontWeight: 700 }}>
            {groupName.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="upload-overlay" style={{
          position: "absolute", inset: 0, borderRadius: 12,
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--on-brand)", fontSize: "0.75rem", fontWeight: 600,
          transition: "opacity 0.15s ease",
        }}
        >
          Upload
        </div>
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>Group Image</p>
        <p style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.125rem" }}>
          JPG, PNG, or WEBP · Auto-cropped to square
        </p>
        {src && (
          <button
            type="button"
            onClick={handleRemove}
            style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, padding: 0, marginTop: "0.25rem", fontFamily: "DM Sans, sans-serif" }}
          >
            Remove image
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
