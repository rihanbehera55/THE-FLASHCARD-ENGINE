export interface TextSection {
  heading: string;
  content: string;
}

export interface TextChunk {
  heading: string;
  content: string;
}

const MAX_SECTION_LENGTH = 2200;
const MAX_CHUNK_LENGTH = 1400;
const MIN_CHUNK_LENGTH = 240;

function normalizeQuotesAndDashes(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...");
}

function stripBrokenCharacters(text: string): string {
  return text
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1");
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isHeading(line: string): boolean {
  if (line.length < 3 || line.length > 80) {
    return false;
  }

  if (/^[0-9]+(\.[0-9]+)*\s+/.test(line)) {
    return true;
  }

  if (/^[A-Z][A-Z\s:&/-]{2,}$/.test(line)) {
    return true;
  }

  return /^[A-Z][A-Za-z0-9\s,:&()/+-]{2,}$/.test(line) && !/[.?!]$/.test(line);
}

function joinWrappedLines(lines: string[]): string[] {
  const merged: string[] = [];

  for (const line of lines) {
    const previous = merged.at(-1);
    if (!previous) {
      merged.push(line);
      continue;
    }

    const previousLooksOpen = !/[.!?:]$/.test(previous);
    const lineLooksContinuation = /^[a-z0-9(]/.test(line);

    if (previousLooksOpen && lineLooksContinuation) {
      merged[merged.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ");
      continue;
    }

    merged.push(line);
  }

  return merged;
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

export function cleanPdfText(rawText: string): string {
  const normalized = normalizeQuotesAndDashes(rawText);
  const stripped = stripBrokenCharacters(normalized);
  const mergedLines = joinWrappedLines(normalizeLines(stripped));

  return mergedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function extractSections(cleanedText: string): TextSection[] {
  const lines = cleanedText.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const sections: TextSection[] = [];
  let currentHeading = "Overview";
  let currentLines: string[] = [];

  const flush = () => {
    const content = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (content.length > 0) {
      sections.push({ heading: currentHeading, content });
    }
    currentLines = [];
  };

  for (const line of lines) {
    if (isHeading(line)) {
      flush();
      currentHeading = line;
      continue;
    }

    currentLines.push(line);
  }

  flush();

  if (sections.length === 0) {
    return [{ heading: "Overview", content: cleanedText.replace(/\s+/g, " ").trim() }];
  }

  return sections.flatMap((section) => {
    if (section.content.length <= MAX_SECTION_LENGTH) {
      return [section];
    }

    const sentences = splitIntoSentences(section.content);
    const splitSections: TextSection[] = [];
    let buffer = "";
    let index = 1;

    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;
      if (candidate.length > MAX_SECTION_LENGTH && buffer) {
        splitSections.push({
          heading: `${section.heading} (Part ${index})`,
          content: buffer,
        });
        buffer = sentence;
        index += 1;
        continue;
      }

      buffer = candidate;
    }

    if (buffer) {
      splitSections.push({
        heading: `${section.heading}${index > 1 ? ` (Part ${index})` : ""}`,
        content: buffer,
      });
    }

    return splitSections;
  });
}

export function chunkSections(sections: TextSection[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const section of sections) {
    const sentences = splitIntoSentences(section.content);
    if (sentences.length === 0) {
      continue;
    }

    let buffer = "";
    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;

      if (candidate.length > MAX_CHUNK_LENGTH && buffer.length >= MIN_CHUNK_LENGTH) {
        chunks.push({ heading: section.heading, content: buffer });
        buffer = sentence;
        continue;
      }

      buffer = candidate;
    }

    if (buffer.trim()) {
      if (
        chunks.length > 0 &&
        buffer.length < MIN_CHUNK_LENGTH &&
        chunks[chunks.length - 1]?.heading === section.heading
      ) {
        chunks[chunks.length - 1] = {
          heading: section.heading,
          content: `${chunks[chunks.length - 1].content} ${buffer}`.trim(),
        };
      } else {
        chunks.push({ heading: section.heading, content: buffer.trim() });
      }
    }
  }

  return chunks.slice(0, 8);
}
