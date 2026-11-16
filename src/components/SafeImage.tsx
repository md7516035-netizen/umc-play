import { useState } from 'react';
import { Shield } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#11151B] via-[#141E22] to-[#0D1318] border border-[#232B38] text-slate-400 p-6 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Shield className="w-8 h-8 text-emerald-500/70 mb-2" />
        <span className="text-xs font-medium tracking-wide text-slate-400 text-center">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
