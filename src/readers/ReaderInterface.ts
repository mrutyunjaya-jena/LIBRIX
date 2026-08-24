import { Document, HighlightStyle } from '../core/types';

export type ReaderTheme = 'dark' | 'light' | 'sepia' | 'high-contrast';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';
export type ReaderScrollMode = 'paginated' | 'continuous';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // in px
  lineHeight: number;
  letterSpacing: number;
  marginHorizontal: number;
  scrollMode: ReaderScrollMode;
  textAlign: 'left' | 'justify';
  brightness: number; // 0 - 100
}

export interface TocItem {
  id: string;
  label: string;
  href: string;
  subitems?: TocItem[];
}

export interface IReaderProps {
  document: Document;
  onClose: () => void;
  onProgressUpdate: (percentage: number, location: string) => void;
  onOpenLibris?: (passage?: string) => void;
}
