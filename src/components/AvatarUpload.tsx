import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  userId?: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
  fallbackInitials?: string;
  size?: "sm" | "lg";
}

const MAX_SIZE = 800;
const QUALITY = 0.8;

const compressImage = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

const AvatarUpload = ({ userId, currentUrl, onUploaded, onRemoved, fallbackInitials, size = "lg" }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 10 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file);

      if (userId) {
        const path = `${userId}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("profile-photos")
          .getPublicUrl(path);

        const url = `${urlData.publicUrl}?t=${Date.now()}`;

        await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", userId);

        onUploaded(url);
      } else {
        // Unauthenticated guest preview
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            onUploaded(reader.result);
          }
        };
        reader.readAsDataURL(compressed);
      }
      toast({ title: "Photo selected ✓" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      if (userId) {
        await supabase.storage.from("profile-photos").remove([`${userId}/avatar.jpg`]);
        await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      }
      onRemoved?.();
      toast({ title: "Photo removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className={cn(sizeClasses, "border-2 border-muted")}>
          {currentUrl && <AvatarImage src={currentUrl} alt="Profile photo" />}
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
            {fallbackInitials || "?"}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className={cn(iconSize, "animate-spin")} /> : <Camera className={iconSize} />}
        </button>

        {currentUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-0 right-0 rounded-full bg-destructive p-1 text-destructive-foreground shadow-md hover:bg-destructive/90 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {currentUrl ? "Tap to change photo" : "Add a photo"}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
};

export default AvatarUpload;
