import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';

interface CoverArtProps {
  src?: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fit?: 'cover' | 'contain';
}

export function CoverArt({
  src,
  alt,
  className = '',
  size = 'md',
  fit = 'cover',
}: CoverArtProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-zinc-200 dark:bg-[#19191F] text-zinc-500 dark:text-[#6E6E78] border border-zinc-300/70 dark:border-white/[0.08] ${className}`}
      >
        <Disc3
          className={
            size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-14 h-14' : 'w-8 h-8'
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
      className={`${
        fit === 'contain' ? 'object-contain' : 'object-cover'
      } bg-zinc-200 dark:bg-[#18181D] ${className}`}
    />
  );
}
