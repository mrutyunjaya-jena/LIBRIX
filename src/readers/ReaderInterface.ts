import { Document, HighlightColor } from '../core/types';

export type ReaderTheme = 'dark' | 'light' | 'sepia' | 'high-contrast';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono' | 'dyslexic';
export type ReaderScrollMode = 'paginated' | 'continuous';
export type ReaderTextAlign = 'left' | 'justify';

export interface ReaderSettings {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number; // 14 to 32px
  lineHeight: number; // 1.2 to 2.4
  letterSpacing: number; // -0.05 to 0.1em
  marginHorizontal: number; // 12 to 96px
  scrollMode: ReaderScrollMode;
  textAlign: ReaderTextAlign;
  brightness: number;
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
  onOpenLibris?: (selectedText?: string) => void;
}
