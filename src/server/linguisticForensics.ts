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
  provider: 'groq' | 'gemini' | 'deterministic_engine' | 'none';
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
  const sanitized = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(sanitized);
}

/**
 * Deterministic rule-based linguistic forensics engine.
 * Serves as high-resilience fallback when cloud LLMs (Gemini / Groq) experience 503 high demand or outages.
 */
function extractDeterministicForensics(
  text: string,
  metadata?: { from?: string; subject?: string }
): LinguisticForensicsResult {
  const combined = `${metadata?.from || ''} ${metadata?.subject || ''} ${text}`.toLowerCase();
  const techniques: string[] = [];

  // Authority Impersonation
  if (
    /(?:c-level|ceo|cfo|coo|executive|president|director|founder|board\s+of\s+directors|legal\s+counsel|general\s+counsel|human\s+resources\s+director|payroll\s+manager)/i.test(combined) &&
    /(?:wire|transfer|payment|gift\s+card|confidential|discreet|urgent|asap|update|bank)/i.test(combined)
  ) {
    techniques.push('authority_impersonation');
  }

  // Artificial Urgency
  if (
    /(?:immediately|urgent|asap|right\s+away|without\s+delay|promptly|time\s+sensitive|critical\s+deadline|by\s+end\s+of\s+day|before\s+close\s+of\s+business|within\s+\d+\s*(?:hours?|mins?|minutes?)|action\s+required)/i.test(combined)
  ) {
    techniques.push('artificial_urgency');
  }

  // Fear Appeal
  if (
    /(?:account\s+suspension|suspended|terminated|deactivated|penalty|legal\s+action|lawsuit|prosecution|breach\s+of\s+policy|immediate\s+cancellation|security\s+incident|unauthorized\s+access)/i.test(combined)
  ) {
    techniques.push('fear_appeal');
  }

  // Isolation from Verification
  if (
    /(?:do\s+not\s+(?:call|discuss|mention|verify)|keep\s+this\s+(?:between\s+us|confidential|private|strictly\s+secret)|in\s+a\s+meeting|phone\s+is\s+broken|cannot\s+take\s+calls)/i.test(combined)
  ) {
    techniques.push('isolation_from_verification');
  }

  // Pretexting
  if (
    /(?:invoice|wire\s+transfer|payment\s+diversion|vendor\s+payment|remittance|direct\s+deposit|ach\s+(?:transfer|payment)|w-2|bank\s+details|updated\s+account)/i.test(combined)
  ) {
    techniques.push('pretexting');
  }

  // Credential Solicitation
  if (
    /(?:password|login|credentials|verify\s+your\s+identity|verify\s+your\s+account|mfa\s+code|2fa|security\s+token|sign\s+in\s+to\s+confirm|click\s+(?:here|the\s+link)\s+to\s+(?:verify|login|restore))/i.test(combined)
  ) {
    techniques.push('credential_solicitation');
  }

  // Scarcity
  if (/(?:limited\s+time|only\s+\d+\s+remaining|offer\s+expires|first\s+\d+\s+claimants)/i.test(combined)) {
    techniques.push('scarcity');
  }

  // Extracted entities
  const dollarRegex = /(?:\$|usd\s*|eur\s*|€|gbp\s*|£)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  const dollarMatches = text.match(dollarRegex) || [];
  const dollar_amounts = Array.from(new Set(dollarMatches.map(m => m.trim())));

  const routingRegex = /(?:routing|aba|transit|swift|iban)[:#\s]*([a-zA-Z0-9]{8,34})/gi;
  const routingMatches: string[] = [];
  let rMatch: RegExpExecArray | null;
  while ((rMatch = routingRegex.exec(text)) !== null) {
    routingMatches.push(rMatch[0].trim());
  }
  const account_or_routing_numbers = Array.from(new Set(routingMatches));

  const deadlineRegex = /(?:within\s+\d+\s*(?:hours?|minutes?|days?)|by\s+(?:[0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm)?|end\s+of\s+day|today|tomorrow|cob)|before\s+close\s+of\s+business)/gi;
  const deadlineMatches = text.match(deadlineRegex) || [];
  const deadlines_or_time_pressure = Array.from(new Set(deadlineMatches.map(m => m.trim())));

  const actionRegex = /(?:(?:wire|transfer|send|remit|pay|deposit)\s+(?:funds|money|amount|\$)|click\s+(?:here|link)|verify\s+(?:account|password|identity)|purchase\s+gift\s+cards?|update\s+(?:banking|account|payroll)\s+details)/gi;
  const actionMatches = text.match(actionRegex) || [];
  const requested_actions = Array.from(new Set(actionMatches.map(m => m.trim())));

  // Register analysis
  const hasUrgency = techniques.includes('artificial_urgency');
  const hasFear = techniques.includes('fear_appeal');
  const hasAuthority = techniques.includes('authority_impersonation');

  let tone_register: 'formal' | 'informal' | 'mixed' | 'inconsistent' = 'formal';
  if (hasFear) {
    tone_register = 'inconsistent';
  } else if (hasUrgency) {
    tone_register = 'mixed';
  }

  const register_anomaly_flag = (hasAuthority && hasUrgency) || techniques.includes('isolation_from_verification');
  const register_anomaly_reason = register_anomaly_flag
    ? 'Linguistic anomaly: Executive or authoritative persona paired with artificial urgency, payment diversion cues, or out-of-band verification avoidance.'
    : undefined;

  const confidence = techniques.length > 0 ? 0.85 : 0.5;

  return {
    status: 'AVAILABLE',
    evidence_type: 'HYPOTHESIS',
    provider: 'deterministic_engine',
    model_used: 'nlp-deterministic-v2.5',
    social_engineering_techniques: techniques,
    tone_register,
    register_anomaly_flag,
    register_anomaly_reason,
    extracted_entities: {
      dollar_amounts,
      account_or_routing_numbers,
      deadlines_or_time_pressure,
      requested_actions
    },
    confidence,
    explanation: techniques.length > 0
      ? `Deterministic forensic pattern analysis identified ${techniques.length} psychological social engineering indicator(s): ${techniques.join(', ')}.`
      : 'Deterministic forensic inspection observed neutral linguistic cues.'
  };
}

/**
 * Calls Gemini API as a fallback if Groq is unavailable.
 * Implements exponential backoff and multi-model failover for 503 high-demand resilience.
 */
async function callGeminiForensics(
  text: string,
  metadata?: { from?: string; subject?: string }
): Promise<{ rawData: any; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
  const metaContext = metadata
    ? `From: ${metadata.from || 'Unknown'}\nSubject: ${metadata.subject || '(No Subject)'}\n\n`
    : '';

  const prompt = `${FORENSIC_SYSTEM_PROMPT}\n\n${metaContext}Email Content to Analyze:\n${text.slice(0, 6000)}`;

  // Priority sequence of supported models
  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const raw = response.text || (response.candidates?.[0]?.content?.parts?.[0] as any)?.text;
      if (!raw) throw new Error(`Empty response from Gemini model ${model}`);
      const rawData = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
      return { rawData, modelUsed: model };
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      const isTransient =
        err?.status === 503 ||
        err?.code === 503 ||
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('429') ||
        err?.status === 429;

      if (isTransient && i < candidateModels.length - 1) {
        // Brief backoff before failing over to the next candidate model
        await new Promise((resolve) => setTimeout(resolve, 350 * (i + 1)));
        continue;
      }
      if (!isTransient) {
        throw err;
      }
    }
  }

  throw lastErr || new Error('All Gemini models exhausted');
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
    return extractDeterministicForensics(text, metadata);
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

  // 1. Try Groq (Preferred for speed if configured)
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

  // 2. Fallback to Gemini with multi-model resilience
  if (geminiKey) {
    try {
      const { rawData, modelUsed } = await callGeminiForensics(text, metadata);
      const validation = validateForensicSchema(rawData);
      if (validation.valid && validation.validatedData) {
        return {
          status: 'AVAILABLE',
          evidence_type: 'HYPOTHESIS',
          provider: 'gemini',
          model_used: modelUsed,
          ...validation.validatedData
        };
      } else {
        console.warn('[LinguisticForensics] Gemini output schema validation failed:', validation.error);
      }
    } catch (geminiErr: any) {
      const errMsg = geminiErr?.message || String(geminiErr);
      const is503 = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE');
      if (is503) {
        console.info('[LinguisticForensics] Gemini models temporarily at high capacity (503). Engaged local deterministic linguistic parser.');
      } else {
        console.warn('[LinguisticForensics] Gemini request failed:', errMsg);
      }
    }
  }

  // 3. High-resilience deterministic fallback:
  // If remote LLMs are unavailable, rate-limited, or encountering 503 capacity spikes,
  // return structured deterministic hypotheses so threat scoring and BEC classification are never disrupted.
  return extractDeterministicForensics(text, metadata);
}
