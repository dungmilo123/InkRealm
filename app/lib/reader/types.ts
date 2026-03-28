export type ParsedReaderChapter = {
  title: string;
  paragraphs: string[];
};

export type ReaderChapter = ParsedReaderChapter & {
  index: number;
};

export type ReaderDocument = {
  novelId: string;
  novelTitle: string;
  fileType: string;
  chapters: ReaderChapter[];
  chapterCount: number;
};

export type ReaderSummary = {
  isReadable: boolean;
  chapterCount: number;
  unavailableReason?: string;
};

export class ReaderUnavailableError extends Error {
  constructor(message = "This novel cannot be read in the built-in reader.") {
    super(message);
    this.name = "ReaderUnavailableError";
  }
}

export class InvalidChapterIndexError extends Error {
  constructor(message = "Requested chapter index is outside the available range.") {
    super(message);
    this.name = "InvalidChapterIndexError";
  }
}
