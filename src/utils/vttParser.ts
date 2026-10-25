/**
 * Lightweight WebVTT Parser
 * Parses WebVTT cues into timestamps (in seconds) and cue text.
 */

export interface VttCue {
  id?: string;
  start: number;
  end: number;
  text: string;
}

/**
 * Parses time format:
 * "00:01:15.000" or "01:15.000" -> seconds (float)
 */
export function parseVttTimestamp(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Parses WebVTT string into an array of VttCue objects.
 */
export function parseVttContent(content: string): VttCue[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues: VttCue[] = [];

  let i = 0;
  // Skip WEBVTT header line and header notes
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->');
      const start = parseVttTimestamp(startStr.split(' ')[0]);
      // End may contain settings like line:0% or align:center
      const endPart = endStr.trim().split(' ')[0];
      const end = parseVttTimestamp(endPart);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          start,
          end,
          text: textLines.join(' ')
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}

/**
 * Retrieves the active cue at the given time in seconds.
 */
export function getActiveCue(cues: VttCue[], currentTime: number): VttCue | null {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (currentTime >= cue.start && currentTime <= cue.end) {
      return cue;
    }
  }
  return null;
}
