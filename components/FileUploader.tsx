/// <reference lib="dom" />
import React, { useCallback } from 'react';
import { Upload, FileVideo } from 'lucide-react';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelected, disabled }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.includes('webm') || file.name.endsWith('.webm')) {
          onFileSelected(file);
        } else {
          window.alert('Proszę wybrać plik WebM.');
        }
      }
    },
    [onFileSelected, disabled]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300
        flex flex-col items-center justify-center gap-4 cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed border-slate-600 bg-slate-800/50' : 'border-indigo-500/50 hover:border-indigo-400 hover:bg-slate-800/80 bg-slate-800/30'}
      `}
      onClick={() => !disabled && document.getElementById('fileInput')?.click()}
    >
      <input
        type="file"
        id="fileInput"
        accept=".webm,video/webm"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
        {disabled ? <FileVideo size={32} /> : <Upload size={32} />}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-200">
          Wybierz lub przeciągnij plik WebM
        </h3>
        <p className="text-sm text-slate-400 mt-2">
          Maksymalny rozmiar zależy od pamięci RAM twojego urządzenia.
        </p>
      </div>
    </div>
  );
};

export default FileUploader;