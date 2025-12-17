import React from 'react';

interface VideoPreviewProps {
  url: string;
  label: string;
  onDuration?: (durationSeconds: number) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ url, label, onDuration }) => {
  return (
    <div className="bg-frozen-spruce/60 rounded-2xl overflow-hidden border border-icy-slate/30 shadow-[0_18px_35px_rgba(0,0,0,0.25)]">
      <div className="bg-cold-shadow-blue/60 px-4 py-2 border-b border-icy-slate/30">
        <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-steel-winter">{label}</span>
      </div>
      <div className="relative aspect-video bg-charcoal-bark/90 flex items-center justify-center">
        <video 
          src={url} 
          controls 
          className="w-full h-full object-contain"
          onLoadedMetadata={
            onDuration
              ? (event) => {
                  const duration = event.currentTarget.duration;
                  if (Number.isFinite(duration) && duration > 0) {
                    onDuration(duration);
                  }
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};

export default VideoPreview;
