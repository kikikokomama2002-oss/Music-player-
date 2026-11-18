import { useState } from 'react';
import { Disc3 } from 'lucide-react';

interface CoverArtProps {
  src: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CoverArt({
  src,
  alt,
  className = '',
  size = 'md',
}: CoverArtProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#222229] via-[#17171C] to-[#0F0F12] text-[#6E6E78] border border-white/[0.08] ${className}`}
      >
        <Disc3
          className={
            size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-7 h-7'
          }
          strokeWidth={1.5}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-[#18181D] ${className}`}
    />
  );
}
