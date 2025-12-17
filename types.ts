export enum ConversionStatus {
  IDLE = 'IDLE',
  LOADING_FFMPEG = 'LOADING_FFMPEG',
  READY = 'READY',
  CONVERTING = 'CONVERTING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface VideoFile {
  file: File;
  url: string;
  name: string;
  size: number;
  durationSeconds?: number;
}

export type VideoQualityPreset = 'high' | 'mid' | 'low';

export type FileConversionStatus = 'idle' | 'queued' | 'converting' | 'completed' | 'error';

export interface LogMessage {
  type: 'info' | 'error' | 'success';
  message: string;
}

export interface CaptionResult {
  caption: string;
  hashtags: string[];
}
