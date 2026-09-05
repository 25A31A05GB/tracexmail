/**
 * TraceXMail LAYER 2 — Structured LLM Linguistic Forensics Engine
 *
 * Categorized Social-Engineering Detection & Register Anomaly Analysis.
 * Invokes Groq (preferred for sub-second inference) or Gemini (fallback),
 * enforcing strict JSON-only outputs.
 *
 * CRITICAL FORENSIC CONSTRAINT:
 * All outputs from this layer are explicitly tagged with evidence_type: 'HYPOTHESIS'.
 * This module NEVER directly dictates primary classifications or hard threat scores;
 * it solely supplements SOC evidence fusion as an explainable linguistic hypothesis.
 *
 * Fail-Loudly & Safe Fallback:
 * If neither GROQ_API_KEY nor GEMINI_API_KEY is configured, or if the LLM JSON
 * schema fails validation, this layer is marked 'UNAVAILABLE' with full provenance.
 */

import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

export interface ExtractedLinguisticEntities {
  dollar_amounts: string[];
  account_or_routing_numbers: string[];
  deadlines_or_time_pressure: string[];
  requested_actions: string[];
}

export interface LinguisticForensicsResult {
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'SKIPPED';
  evidence_type: 'HYPOTHESIS';
  provider: 'groq' | 'gemini' | 'none';
  model_used: string;
  social_engineering_techniques: string[];
  tone_register: 'formal' | 'informal' | 'mixed' | 'inconsistent';
  register_anomaly_flag: boolean;
  register_anomaly_reason?: string;
  extracted_entities: ExtractedLinguisticEntities;
  confidence: number;
  explanation?: string;
  error?: string;
}

const FORENSIC_SYSTEM_PROMPT = `You are an expert digital forensics and natural language processing analyst specialized in email social-engineering analysis.
Analyze the provided email content for linguistic patterns, psychological manipulation, tone inconsistency, and extracted entity cues.

You MUST reply ONLY with a valid, parseable JSON object matching this EXACT schema:
{
  "social_engineering_techniques": [
    "authority_impersonation",
    "artificial_urgency",
    "fear_appeal",
    "scarcity",
    "isolation_from_verification",
    "pretexting",
    "reciprocity_lure",
    "credential_solicitation"
  ],
  "tone_register": "formal" | "informal" | "mixed" | "inconsistent",
  "register_anomaly_flag": boolean,
  "register_anomaly_reason": string,
  "extracted_entities": {
    "dollar_amounts": ["string"],
    "account_or_routing_numbers": ["string"],
    "deadlines_or_time_pressure": ["string"],
    "requested_actions": ["string"]
  },
  "confidence": number,
  "explanation": "Brief 1-2 sentence forensic explanation"
}

RULES:
1. ONLY include techniques that are actually present in the text. If none, return empty array [].
2. register_anomaly_flag should be TRUE if an executive or formal entity writes casually, uses uncharacteristic syntax, or shifts tone abruptly.
3. confidence MUST be a float between 0.0 and 1.0.
4. Output RAW JSON ONLY. No markdown formatting, no backticks (\`\`\`json), no prose prefix or suffix.`;

/**
 * Validates the raw JSON object returned by the LLM against the expected schema.
 */
function validateForensicSchema(data: any): { valid: boolean; validatedData?: any; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Output is not an object' };
  }

  // social_engineering_techniques
  if (!Array.isArray(data.social_engineering_techniques)) {
    return { valid: false, error: 'social_engineering_techniques must be an array' };
  }

  // tone_register
  const validRegisters = ['formal', 'informal', 'mixed', 'inconsistent'];
  const tone_register = validRegisters.includes(data.tone_register) ? data.tone_register : 'inconsistent';

  // register_anomaly_flag
  const register_anomaly_flag = Boolean(data.register_anomaly_flag);

  // extracted_entities
  const entities = data.extracted_entities || {};
  const dollar_amounts = Array.isArray(entities.dollar_amounts) ? entities.dollar_amounts.map(String) : [];
  const account_or_routing_numbers = Array.isArray(entities.account_or_routing_numbers) ? entities.account_or_routing_numbers.map(String) : [];
  const deadlines_or_time_pressure = Array.isArray(entities.deadlines_or_time_pressure) ? entities.deadlines_or_time_pressure.map(String) : [];
  const requested_actions = Array.isArray(entities.requested_actions) ? entities.requested_actions.map(String) : [];

  // confidence
  let confidence = typeof data.confidence === 'number' ? data.confidence : 0.5;
  if (isNaN(confidence) || confidence < 0) confidence = 0;
  if (confidence > 1.0) confidence = 1.0;

  return {
    valid: true,
    validatedData: {
      social_engineering_techniques: data.social_engineering_techniques.map(String),
      tone_register,
      register_anomaly_flag,
      register_anomaly_reason: data.register_anomaly_reason ? String(data.register_anomaly_reason) : undefined,
      extracted_entities: {
        dollar_amounts,
        account_or_routing_numbers,
        deadlines_or_time_pressure,
        requested_actions
      },
      confidence: parseFloat(confidence.toFixed(3)),
      explanation: data.explanation ? String(data.explanation) : undefined
    }
  };
}

/**
 * Calls Groq API for rapid LLM linguistic analysis.
 */
async function callGroqForensics(text: string, metadata?: { from?: string; subject?: string }): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const metaContext = metadata
    ? `From: ${metadata.from || 'Unknown'}\nSubject: ${metadata.subject || '(No Subject)'}\n\n`
    : '';

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: FORENSIC_SYSTEM_PROMPT },
        { role: 'user', content: `${metaContext}Email Content to Analyze:\n${text.slice(0, 6000)}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from Groq');
  return JSON.parse(raw);
}

/**
 * Calls Gemini API as a fallback if Groq is unavailable.
 */
async function callGeminiForensics(text: string, metadata?: { from?: string; subject?: string }): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });
  const metaContext = metadata
    ? `From: ${metadata.from || 'Unknown'}\nSubject: ${metadata.subject || '(No Subject)'}\n\n`
    : '';

  const prompt = `${FORENSIC_SYSTEM_PROMPT}\n\n${metaContext}Email Content to Analyze:\n${text.slice(0, 6000)}`;

  // @ts-ignore - GoogleGenAI call with JSON configuration
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  });

  const raw = response.text || (response.candidates?.[0]?.content?.parts?.[0] as any)?.text;
  if (!raw) throw new Error('Empty response from Gemini');
  return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
}

/**
 * LAYER 2 Main Entry Point:
 * Performs structured LLM linguistic forensics and returns validated hypotheses.
 */
export async function analyzeLinguisticForensics(
  text: string,
  metadata?: { from?: string; subject?: string }
): Promise<LinguisticForensicsResult> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return {
      status: 'UNAVAILABLE',
      evidence_type: 'HYPOTHESIS',
      provider: 'none',
      model_used: 'none',
      social_engineering_techniques: [],
      tone_register: 'formal',
      register_anomaly_flag: false,
      extracted_entities: {
        dollar_amounts: [],
        account_or_routing_numbers: [],
        deadlines_or_time_pressure: [],
        requested_actions: []
      },
      confidence: 0,
      error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured. Layer 2 LLM linguistic forensics marked UNAVAILABLE.'
    };
  }

  if (!text || text.trim().length < 15) {
    return {
      status: 'SKIPPED',
      evidence_type: 'HYPOTHESIS',
      provider: 'none',
      model_used: 'none',
      social_engineering_techniques: [],
      tone_register: 'formal',
      register_anomaly_flag: false,
      extracted_entities: {
        dollar_amounts: [],
        account_or_routing_numbers: [],
        deadlines_or_time_pressure: [],
        requested_actions: []
      },
      confidence: 0,
      error: 'Insufficient text content for linguistic forensics.'
    };
  }

  // 1. Try Groq (Preferred for speed)
  if (groqKey) {
    try {
      const rawData = await callGroqForensics(text, metadata);
      const validation = validateForensicSchema(rawData);
      if (validation.valid && validation.validatedData) {
        return {
          status: 'AVAILABLE',
          evidence_type: 'HYPOTHESIS',
          provider: 'groq',
          model_used: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          ...validation.validatedData
        };
      } else {
        console.warn('[LinguisticForensics] Groq output schema validation failed:', validation.error);
      }
    } catch (groqErr: any) {
      console.warn('[LinguisticForensics] Groq request failed, attempting fallback:', groqErr?.message);
    }
  }

  // 2. Fallback to Gemini
  if (geminiKey) {
    try {
      const rawData = await callGeminiForensics(text, metadata);
      const validation = validateForensicSchema(rawData);
      if (validation.valid && validation.validatedData) {
        return {
          status: 'AVAILABLE',
          evidence_type: 'HYPOTHESIS',
          provider: 'gemini',
          model_used: 'gemini-3.6-flash',
          ...validation.validatedData
        };
      } else {
        console.warn('[LinguisticForensics] Gemini output schema validation failed:', validation.error);
      }
    } catch (geminiErr: any) {
      console.warn('[LinguisticForensics] Gemini request failed:', geminiErr?.message);
    }
  }

  // If both failed or produced invalid schema, fail loudly and treat as UNAVAILABLE
  return {
    status: 'UNAVAILABLE',
    evidence_type: 'HYPOTHESIS',
    provider: 'none',
    model_used: 'none',
    social_engineering_techniques: [],
    tone_register: 'formal',
    register_anomaly_flag: false,
    extracted_entities: {
      dollar_amounts: [],
      account_or_routing_numbers: [],
      deadlines_or_time_pressure: [],
      requested_actions: []
    },
    confidence: 0,
    error: 'LLM linguistic forensics parsing failed or APIs unreachable. Layer marked UNAVAILABLE.'
  };
}
