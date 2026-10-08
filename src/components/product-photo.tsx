import Image from "next/image";
import type { ProductPhoto as Photo } from "@/content/product-photos";

/**
 * One treatment for every product photo: 16:10 crop, panel radius, cover fit
 * with the photo's own focal point. `preload` only for the page's hero photo;
 * everything else lazy-loads (the next/image default).
 */
export function ProductPhoto({
  photo,
  sizes,
  preload = false,
  className = "",
  rounded = "rounded-[var(--radius-panel)]",
}: {
  photo: Photo;
  sizes: string;
  preload?: boolean;
  className?: string;
  rounded?: string;
}) {
  return (
    <div className={`relative aspect-[16/10] overflow-hidden bg-sky ${rounded} ${className}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        preload={preload}
        placeholder="blur"
        className="object-cover"
        style={{ objectPosition: photo.position }}
      />
    </div>
  );
}
