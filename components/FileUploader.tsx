/// <reference lib="dom" />
import React, { useCallback } from 'react';
import { Upload, FileVideo } from 'lucide-react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  variant?: 'full' | 'compact';
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, disabled, variant = 'full' }) => {
  const isCompact = variant === 'compact';
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const accepted = files.filter((file) => file.type.includes('webm') || file.name.endsWith('.webm'));
        if (!accepted.length) {
          window.alert('Prosze wybrac pliki WebM.');
          return;
        }
        if (accepted.length < files.length) {
          window.alert('Czesc plikow pominieto (dozwolone tylko WebM).');
        }
        onFilesSelected(accepted);
      }
    },
    [onFilesSelected, disabled]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const accepted = files.filter((file) => file.type.includes('webm') || file.name.endsWith('.webm'));
      if (!accepted.length) {
        window.alert('Prosze wybrac pliki WebM.');
        return;
      }
      if (accepted.length < files.length) {
        window.alert('Czesc plikow pominieto (dozwolone tylko WebM).');
      }
      onFilesSelected(accepted);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`
        border-2 border-dashed rounded-2xl text-center transition-all duration-300 shadow-[0_12px_30px_rgba(0,0,0,0.25)]
        flex flex-col items-center justify-center gap-4 cursor-pointer
        ${isCompact ? 'p-4 sm:p-6' : 'p-10'}
        ${disabled ? 'opacity-60 cursor-not-allowed border-icy-slate/40 bg-frozen-spruce/40' : 'border-icy-slate/50 hover:border-frost/40 hover:bg-cold-shadow-blue/50 bg-cold-shadow-blue/25'}
      `}
      onClick={() => !disabled && document.getElementById('fileInput')?.click()}
    >
      <input
        type="file"
        id="fileInput"
        accept=".webm,video/webm"
        multiple
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <div className={`${isCompact ? 'w-10 h-10' : 'w-16 h-16'} bg-deep-forest-teal/40 rounded-full flex items-center justify-center text-frost`}>
        {disabled ? <FileVideo size={isCompact ? 20 : 32} /> : <Upload size={isCompact ? 20 : 32} />}
      </div>
      <div>
        <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-display font-semibold text-frost`}>
          {isCompact ? 'Dodaj kolejne pliki WebM' : 'Wybierz lub przeciagnij pliki WebM'}
        </h3>
        <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-steel-winter mt-2`}>
          Maksymalny rozmiar zalezy od pamieci RAM twojego urzadzenia.
        </p>
      </div>
    </div>
  );
};

export default FileUploader;
