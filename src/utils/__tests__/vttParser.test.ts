import { describe, it, expect } from 'vitest';
import { parseVttTimestamp, parseVttContent, getActiveCue } from '../vttParser';

describe('vttParser', () => {
  it('parses timestamps in hh:mm:ss.mmm and mm:ss.mmm format', () => {
    expect(parseVttTimestamp('00:00:15.000')).toBe(15);
    expect(parseVttTimestamp('00:01:30.500')).toBe(90.5);
    expect(parseVttTimestamp('02:15.000')).toBe(135);
  });

  it('parses full WebVTT content into cues', () => {
    const sampleVtt = `WEBVTT - TraceXMail Overview

00:00:00.000 --> 00:00:15.000
Most people believe that dangerous emails are easy to spot.

00:00:15.000 --> 00:00:30.000
Today's cyber attackers don't work that way.
`;

    const cues = parseVttContent(sampleVtt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      start: 0,
      end: 15,
      text: 'Most people believe that dangerous emails are easy to spot.'
    });
    expect(cues[1]).toEqual({
      start: 15,
      end: 30,
      text: "Today's cyber attackers don't work that way."
    });
  });

  it('identifies the active cue at a specific time', () => {
    const cues = [
      { start: 0, end: 10, text: 'First segment' },
      { start: 10, end: 25, text: 'Second segment' },
      { start: 25, end: 40, text: 'Third segment' }
    ];

    expect(getActiveCue(cues, 5)?.text).toBe('First segment');
    expect(getActiveCue(cues, 18)?.text).toBe('Second segment');
    expect(getActiveCue(cues, 35)?.text).toBe('Third segment');
    expect(getActiveCue(cues, 50)).toBeNull();
  });
});
