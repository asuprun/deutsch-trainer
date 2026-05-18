'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function UploadZone({ onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!ACCEPT.split(',').includes(file.type)) {
        setError(`Поддерживаются только JPEG, PNG, WebP (получен ${file.type || '?'})`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`Файл слишком большой: ${(file.size / 1024 / 1024).toFixed(1)} MB (макс ${MAX_BYTES / 1024 / 1024} MB)`);
        return;
      }
      setError(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      onFile(file);
    },
    [onFile, preview],
  );

  useEffect(() => {
    if (disabled) return;
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile, disabled]);

  function onDragOver(e: React.DragEvent) {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    if (disabled) return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  function clear() {
    setError(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Загруженный скриншот" className="w-full max-h-[60vh] object-contain bg-muted" />
        {!disabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={clear}
            className="absolute top-2 right-2"
          >
            <X className="size-4 mr-1" />
            Сбросить
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <Upload className="size-10 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium">Перетащи скриншот сюда</p>
        <p className="mt-1 text-sm text-muted-foreground">или нажми, чтобы выбрать файл · Ctrl+V — вставить из буфера</p>
        <p className="mt-2 text-xs text-muted-foreground">JPEG / PNG / WebP, до 8 MB</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
