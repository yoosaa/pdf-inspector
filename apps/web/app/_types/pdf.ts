export type PdfAnalysisResult = {
  filename: string;
  fileSize: number;
  pageCount: number;
  encrypted: boolean;
  metadata: {
    title: string | null;
    author: string | null;
    subject: string | null;
    creator: string | null;
  };
  text: {
    totalCharacters: number;
    preview: string;
  };
  pages: {
    pageNumber: number;
    characters: number;
    hasText: boolean;
  }[];
};