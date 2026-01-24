export type SignalStrength = "strong" | "weak";

export type SignalPattern = {
  name: string;
  regex: RegExp;
  strength: SignalStrength;
};

export type PreprocessRemovedMeta = {
  comments: number;
  strings: number;
  failed?: boolean;
};

export type PreprocessResult = {
  cleaned: string;
  removed: PreprocessRemovedMeta;
};

export type SignalMatch = {
  name: string;
  strength: SignalStrength;
  regex: string;
  match: string;
  index: number;
};

const isEscaped = (text: string, index: number): boolean => {
  let slashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && text[cursor] === "\\") {
    slashCount += 1;
    cursor -= 1;
  }
  return slashCount % 2 === 1;
};

const toSafeRegex = (regex: RegExp): RegExp => {
  const flags = new Set(regex.flags.split(""));
  flags.add("g");
  flags.add("i");
  return new RegExp(regex.source, [...flags].join(""));
};

const blankChar = (char: string): string => (char === "\n" ? "\n" : " ");

export const preprocessSource = (text: string): PreprocessResult => {
  try {
    const chars = Array.from(text);
    let comments = 0;
    let strings = 0;
    let index = 0;

    const blankRange = (start: number, endExclusive: number): void => {
      for (let cursor = start; cursor < endExclusive; cursor += 1) {
        chars[cursor] = blankChar(chars[cursor]);
      }
    };

    while (index < chars.length) {
      const char = chars[index];
      const next = chars[index + 1];

      if (char === "/" && next === "/") {
        comments += 1;
        const start = index;
        index += 2;
        while (index < chars.length && chars[index] !== "\n") {
          index += 1;
        }
        blankRange(start, index);
        continue;
      }

      if (char === "/" && next === "*") {
        comments += 1;
        const start = index;
        index += 2;
        while (index < chars.length) {
          if (chars[index] === "*" && chars[index + 1] === "/") {
            index += 2;
            break;
          }
          index += 1;
        }
        blankRange(start, index);
        continue;
      }

      if ((char === "\"" || char === "'" || char === "`") && !isEscaped(text, index)) {
        strings += 1;
        const quote = char;
        const start = index;
        index += 1;
        while (index < chars.length) {
          if (chars[index] === quote && !isEscaped(text, index)) {
            index += 1;
            break;
          }
          index += 1;
        }
        blankRange(start, index);
        continue;
      }

      index += 1;
    }

    return {
      cleaned: chars.join(""),
      removed: { comments, strings },
    };
  } catch (_error) {
    return {
      cleaned: text,
      removed: { comments: 0, strings: 0, failed: true },
    };
  }
};

export const findSignals = (
  cleaned: string,
  patterns: SignalPattern[]
): SignalMatch[] => {
  const matches: SignalMatch[] = [];

  patterns.forEach((pattern) => {
    try {
      const regex = toSafeRegex(pattern.regex);
      let result: RegExpExecArray | null = regex.exec(cleaned);
      while (result) {
        matches.push({
          name: pattern.name,
          strength: pattern.strength,
          regex: regex.toString(),
          match: result[0],
          index: result.index,
        });

        if (regex.lastIndex === result.index) {
          regex.lastIndex += 1;
        }
        result = regex.exec(cleaned);
      }
    } catch (_error) {
      // Best-effort matching: ignore invalid regex executions.
    }
  });

  return matches;
};

export const formatEvidence = (
  matches: SignalMatch[],
  meta: {
    preprocess: PreprocessRemovedMeta;
  }
): string => {
  const preprocessLine = meta.preprocess.failed
    ? "Preprocess: failed (fallback raw) via sourceScan."
    : "Preprocess: comments/strings removed via sourceScan.";

  if (matches.length === 0) {
    return preprocessLine;
  }

  const matchLines = matches.map(
    (match) =>
      `Matched: ${match.name} (${match.regex}) via sourceScan.`
  );

  return [preprocessLine, ...matchLines].join(" ");
};
