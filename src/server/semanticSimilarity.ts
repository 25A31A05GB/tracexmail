/**
 * TraceXMail LAYER 1 — Semantic Embedding Similarity Engine
 *
 * Catches paraphrased attacks and novel semantic variants that TF-IDF misses.
 * Uses Gemini text-embedding-004 via GEMINI_API_KEY to embed email content and
 * compares cosine similarity against a curated reference corpus of canonical
 * attack patterns and legitimate enterprise templates.
 *
 * Degrades gracefully: If GEMINI_API_KEY is unset or uncontactable, skips this layer,
 * logs a clear warning, and returns status 'UNAVAILABLE' without fabricating scores.
 */

import crypto from 'crypto';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { pipeline, env } from '@xenova/transformers';

// Configure transformers environment: allow remote HF downloads, cache locally
env.allowLocalModels = false;

export interface ReferenceTemplate {
  id: string;
  category: 'Phishing' | 'Fraud-related' | 'Impersonated' | 'Suspicious' | 'Legitimate';
  title: string;
  text: string;
}

export interface SemanticSimilarityResult {
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'SKIPPED';
  classSimilarities: Record<string, number>;
  nearestTemplate: string | null;
  nearestClass: string | null;
  topSimilarity: number;
  details?: {
    clusters: Record<string, { topScore: number; avgScore: number; sampleCount: number }>;
    nearestTemplateTitle?: string;
    model: string;
    provider?: 'gemini' | 'local_transformers' | 'none';
    dimension?: number;
    fallbackUsed?: boolean;
    reason?: string;
  };
  error?: string;
}

// Curated canonical reference templates across all 5 operational classes
export const REFERENCE_TEMPLATES: ReferenceTemplate[] = [
  // 1. Phishing (Credential harvesting & malware lures)
  {
    id: 'phish_m365_pwd',
    category: 'Phishing',
    title: 'Microsoft 365 Password Expiration Notice',
    text: 'Your Microsoft Office 365 work account password will expire in 24 hours. Keep your current password by clicking the link below to verify your credentials. If you do not verify immediately, your access to Outlook, OneDrive, and Teams will be suspended.'
  },
  {
    id: 'phish_paypal_lock',
    category: 'Phishing',
    title: 'PayPal Account Suspension Warning',
    text: 'We detected unauthorized login attempts to your PayPal account from an unrecognized IP address. To prevent permanent restriction and protect your funds, verify your identity and credit card details now by accessing our secure portal.'
  },
  {
    id: 'phish_docusign_lure',
    category: 'Phishing',
    title: 'DocuSign Signature Required for Confidential Document',
    text: 'Please review and sign the attached confidential agreement from HR and Legal. Click the secure DocuSign envelope link to authenticate with your corporate credentials and complete the signature before the deadline.'
  },
  {
    id: 'phish_dhl_tracking',
    category: 'Phishing',
    title: 'DHL Express Delivery Exception & Re-delivery Fee',
    text: 'Your package could not be delivered due to an incorrect shipping address. Please download the attached shipping receipt and pay the outstanding $2.50 customs fee to reschedule redelivery.'
  },
  {
    id: 'phish_google_auth',
    category: 'Phishing',
    title: 'Google Workspace Critical Security Alert',
    text: 'Someone just used your password to try to sign in to your Google Account from a Linux device in Russia. If this was not you, please recover and secure your account immediately by following the link.'
  },
  {
    id: 'phish_netflix_billing',
    category: 'Phishing',
    title: 'Netflix Subscription Billing Decline',
    text: 'We were unable to validate your billing details for the next subscription cycle. Please update your payment method within 48 hours to avoid service cancellation.'
  },
  {
    id: 'phish_bank_alert',
    category: 'Phishing',
    title: 'Online Banking Security Profile Update',
    text: 'Due to recent system security upgrades, all banking customers are required to re-verify their online banking profile and security questions to maintain account active status.'
  },
  {
    id: 'phish_webmail_quota',
    category: 'Phishing',
    title: 'Mailbox Quota Exceeded Final Notice',
    text: 'Your email storage has exceeded 99.8% capacity. Incoming emails are currently being rejected. Click here to increase your mailbox quota and prevent permanent message deletion.'
  },

  // 2. Fraud-related (BEC, Wire Diversion & Invoice Fraud)
  {
    id: 'bec_wire_ceo',
    category: 'Fraud-related',
    title: 'CEO Urgent Wire Transfer Request',
    text: 'Are you available at your desk right now? I need you to process an urgent wire transfer for a confidential vendor acquisition before close of business today. Please reply with the current account balance so I can send the wiring instructions.'
  },
  {
    id: 'bec_vendor_invoice',
    category: 'Fraud-related',
    title: 'Supplier Banking Information & Remittance Change',
    text: 'Please note that our company has recently changed banking partners for audit purposes. Effective immediately, remit all outstanding invoices and future payments to our new account with ABA Routing 021000021 and Account Number 8472910482.'
  },
  {
    id: 'bec_direct_deposit',
    category: 'Fraud-related',
    title: 'Urgent Payroll Direct Deposit Account Change',
    text: 'I recently switched banks and need to update my direct deposit information for this upcoming pay period. Can you please update my payroll routing number and checking account before payroll is processed?'
  },
  {
    id: 'bec_gift_cards',
    category: 'Fraud-related',
    title: 'Executive Client Appreciation Gift Cards Request',
    text: 'I am currently in a closed-door meeting and cannot take calls. I need you to discreetly purchase 10 Apple / Steam gift cards ($100 each) for an executive presentation. Scratch the codes and email photos of the back to me.'
  },
  {
    id: 'bec_confidential_settlement',
    category: 'Fraud-related',
    title: 'Confidential Legal Settlement Wire Authorization',
    text: 'Per our discussion with outside counsel regarding the pending settlement, please wire the initial installment of $75,000.00 to the designated escrow trust account attached. Keep this matter strictly between us.'
  },
  {
    id: 'bec_vendor_overdue',
    category: 'Fraud-related',
    title: 'Overdue Invoice Final Notice Before Supply Disruption',
    text: 'Our records indicate invoice INV-94821 for $42,300.00 remains unpaid. Please wire the funds to the updated IBAN DE89370400440532013000 today to prevent immediate shipment hold.'
  },

  // 3. Impersonated (Brand lookalikes & Executive Spoofing)
  {
    id: 'imper_it_helpdesk',
    category: 'Impersonated',
    title: 'Internal IT Helpdesk System Upgrade Notice',
    text: 'The Global IT Infrastructure team will perform routine certificate upgrades tonight. All staff must re-authenticate their active directory credentials via the employee service portal below to maintain single sign-on.'
  },
  {
    id: 'imper_hr_survey',
    category: 'Impersonated',
    title: 'Human Resources Annual Compensation Survey',
    text: 'Human Resources invites all corporate employees to complete the confidential 2026 Compensation and Benefits Review. Log in with your corporate email to submit your feedback.'
  },
  {
    id: 'imper_exec_advisory',
    category: 'Impersonated',
    title: 'Corporate Executive Office Advisory Notice',
    text: 'A critical organizational directive has been issued by executive management regarding internal operational guidelines. Review the attached directive and acknowledge receipt.'
  },
  {
    id: 'imper_zoom_recording',
    category: 'Impersonated',
    title: 'Zoom Cloud Meeting Recording Ready for Access',
    text: 'Your recorded Zoom meeting from yesterday is now available for review. Sign in with your corporate SSO account to view the cloud transcript and video recording.'
  },

  // 4. Suspicious (Spam, Unsolicited B2B Outbound, Aggressive Marketing)
  {
    id: 'susp_b2b_leads',
    category: 'Suspicious',
    title: 'Unsolicited B2B Lead List & Database Sales',
    text: 'Hi there, we have a verified list of 500,000 B2B Decision Makers and VP-level contacts in your industry. Would you be interested in purchasing this database with direct phone numbers and emails?'
  },
  {
    id: 'susp_crypto_pitch',
    category: 'Suspicious',
    title: 'Guaranteed High-Yield Cryptocurrency Trading Proposal',
    text: 'Earn guaranteed 25% weekly returns with our automated algorithmic crypto trading platform. Limited slots available for institutional and high-net-worth investors. Register today.'
  },
  {
    id: 'susp_seo_services',
    category: 'Suspicious',
    title: 'Cold SEO & Website Traffic Optimization Outreach',
    text: 'We analyzed your website and identified 15 critical errors affecting your Google search rankings. We can guarantee first page placement within 30 days. Reply to discuss pricing.'
  },

  // 5. Legitimate (Benign enterprise IT, DevOps, Cloud Infrastructure & Routine Comms)
  {
    id: 'legit_github_pr',
    category: 'Legitimate',
    title: 'GitHub Pull Request Review Notification',
    text: 'jayramsappa opened pull request #42 in repository enterprise/core-service: Refactor auth middleware to support PKCE OAuth2 flow. Review requested for changes in server.ts and src/auth.ts.'
  },
  {
    id: 'legit_aws_cloudwatch',
    category: 'Legitimate',
    title: 'AWS CloudWatch Alarm State Change to OK',
    text: 'You are receiving this email because your Amazon CloudWatch Alarm "HighCPUUtilization-AppCluster" in region us-east-1 has entered state OK. Threshold crossed: CPU utilization dropped below 40.0% for 3 consecutive periods.'
  },
  {
    id: 'legit_gsuite_calendar',
    category: 'Legitimate',
    title: 'Google Calendar Meeting Invitation',
    text: 'Invitation: Weekly Engineering Sync & Sprint Planning @ Mon Sep 8, 2026 10am - 11am (PDT). Location: Google Meet. Attendees: dev-team@enterprise.corp. Agenda attached in Google Docs.'
  },
  {
    id: 'legit_jira_ticket',
    category: 'Legitimate',
    title: 'Jira Software Issue Assigned Notification',
    text: 'Issue SEC-892 "Implement rate limiting on public auth endpoints" was assigned to you by Security Lead. Priority: High. Component: API Gateway. Target Sprint: Sprint 34.'
  },
  {
    id: 'legit_datadog_alert',
    category: 'Legitimate',
    title: 'Datadog Monitor Recovered: Ingress Latency P99',
    text: 'Monitor [P1] Ingress Controller P99 Latency > 250ms has recovered. Current value: 42ms. Host: k8s-node-worker-08. Status: All systems operating within normal parameters.'
  },
  {
    id: 'legit_stripe_receipt',
    category: 'Legitimate',
    title: 'Stripe Payment Receipt for Monthly Cloud Subscription',
    text: 'Your payment of $249.00 for your monthly Enterprise Team Plan was successful. Receipt number: REC-2026-94812. Payment method: Visa ending in 4242. View your invoice in the customer portal.'
  }
];

// STRICT VECTOR ISOLATION:
// Gemini vectors (768-d) and Local Transformer vectors (384-d) live in completely separate caches.
// Under NO circumstances are vectors from different embedding spaces ever compared against each other.
const referenceEmbeddingsGeminiCache = new Map<string, number[]>();
const incomingEmbeddingsGeminiCache = new Map<string, number[]>();
let isPrecomputingGemini = false;

const referenceEmbeddingsLocalCache = new Map<string, number[]>();
const incomingEmbeddingsLocalCache = new Map<string, number[]>();
let isPrecomputingLocal = false;

// Local Transformer Pipeline State
let localExtractor: any = null;
let isInitializingLocalModel = false;
let localModelStatus: 'UNINITIALIZED' | 'INITIALIZING' | 'READY' | 'FAILED' = 'UNINITIALIZED';
let localModelError: string | null = null;

/**
 * Initializes the local Xenova/all-MiniLM-L6-v2 pipeline at server cold-start
 * and precomputes reference template embeddings so analysts never suffer cold-start latency.
 */
export async function initializeLocalEmbeddingModel(): Promise<boolean> {
  if (localExtractor && localModelStatus === 'READY' && referenceEmbeddingsLocalCache.size >= REFERENCE_TEMPLATES.length) {
    return true;
  }
  if (isInitializingLocalModel) {
    return false;
  }
  isInitializingLocalModel = true;
  localModelStatus = 'INITIALIZING';

  try {
    console.log('[SemanticEmbedding] Cold-start initialization: Loading local Xenova/all-MiniLM-L6-v2 pipeline...');
    localExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true
    });
    localModelStatus = 'READY';
    localModelError = null;
    console.log('[SemanticEmbedding] Xenova/all-MiniLM-L6-v2 pipeline ready. Pre-computing local reference corpus...');
    await precomputeLocalReferenceEmbeddings();
    console.log(`[SemanticEmbedding] Successfully pre-computed ${referenceEmbeddingsLocalCache.size}/${REFERENCE_TEMPLATES.length} reference vectors with local model.`);
    return true;
  } catch (err: any) {
    localModelStatus = 'FAILED';
    localModelError = err?.message || 'Failed to initialize local transformer model';
    console.error('[SemanticEmbedding] Local model initialization failed:', localModelError);
    return false;
  } finally {
    isInitializingLocalModel = false;
  }
}

export function getLocalEmbeddingModelStatus() {
  return {
    status: localModelStatus,
    isReady: localModelStatus === 'READY',
    cachedReferenceCount: referenceEmbeddingsLocalCache.size,
    error: localModelError,
    modelName: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384
  };
}

/**
 * Computes cosine similarity between two numeric vectors in the exact same embedding space.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA <= 0 || normB <= 0) return 0;
  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1.0, sim));
}

/**
 * Generates an embedding vector using the local offline Xenova/all-MiniLM-L6-v2 model (384-d).
 */
export async function embedWithLocalModel(text: string): Promise<number[] | null> {
  const clean = text.slice(0, 4000).trim();
  if (!clean) return null;

  const hash = crypto.createHash('sha256').update(clean).digest('hex');
  if (incomingEmbeddingsLocalCache.has(hash)) {
    return incomingEmbeddingsLocalCache.get(hash)!;
  }

  if (!localExtractor) {
    const ok = await initializeLocalEmbeddingModel();
    if (!ok || !localExtractor) return null;
  }

  try {
    const output = await localExtractor(clean, { pooling: 'mean', normalize: true });
    const vec: number[] = Array.from(output.data);
    if (vec.length === 384) {
      incomingEmbeddingsLocalCache.set(hash, vec);
      return vec;
    }
    return null;
  } catch (err: any) {
    console.warn('[SemanticEmbedding] Local embedding error:', err?.message);
    return null;
  }
}

/**
 * Pre-computes and caches all reference template embeddings using the local model.
 */
async function precomputeLocalReferenceEmbeddings(): Promise<boolean> {
  if (isPrecomputingLocal) return false;
  isPrecomputingLocal = true;

  try {
    for (const tmpl of REFERENCE_TEMPLATES) {
      if (!referenceEmbeddingsLocalCache.has(tmpl.id)) {
        const output = await localExtractor(tmpl.text, { pooling: 'mean', normalize: true });
        const vec: number[] = Array.from(output.data);
        if (vec.length === 384) {
          referenceEmbeddingsLocalCache.set(tmpl.id, vec);
        }
      }
    }
    return referenceEmbeddingsLocalCache.size >= REFERENCE_TEMPLATES.length;
  } finally {
    isPrecomputingLocal = false;
  }
}

let geminiCooldownUntil = 0;

/**
 * Fetches an embedding vector for a given text using Gemini text-embedding-004 (768-d).
 */
async function fetchGeminiEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (Date.now() < geminiCooldownUntil) {
    return null;
  }

  const clean = text.slice(0, 8000).trim();
  if (!clean) return null;

  // Check cache first by SHA256
  const hash = crypto.createHash('sha256').update(clean).digest('hex');
  if (incomingEmbeddingsGeminiCache.has(hash)) {
    return incomingEmbeddingsGeminiCache.get(hash)!;
  }

  // 1. Try GoogleGenAI SDK
  try {
    const ai = new GoogleGenAI({ apiKey });
    // @ts-ignore - SDK embedding invocation
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: clean
    });

    // @ts-ignore
    const values = response?.embedding?.values || response?.values || (Array.isArray(response?.embeddings) ? response.embeddings[0]?.values : undefined);
    if (Array.isArray(values) && values.length > 0) {
      incomingEmbeddingsGeminiCache.set(hash, values);
      return values;
    }
  } catch (sdkErr: any) {
    // Fall back to direct REST API if SDK method signature differs
  }

  // 2. Direct REST API Fallback
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await axios.post(
      url,
      {
        content: {
          parts: [{ text: clean }]
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 6000
      }
    );

    const values = resp.data?.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      incomingEmbeddingsGeminiCache.set(hash, values);
      return values;
    }
  } catch (restErr: any) {
    geminiCooldownUntil = Date.now() + 2 * 60 * 1000;
    const errMsg = restErr?.response?.data?.error?.message || restErr?.message || 'API request failed';
    console.info(`[SemanticEmbedding] Cloud embedding unavailable (${errMsg}), using offline local model.`);
  }

  return null;
}

/**
 * Pre-computes and caches reference template embeddings using Gemini text-embedding-004.
 */
export async function ensureReferenceEmbeddingsLoaded(apiKey: string): Promise<boolean> {
  if (Date.now() < geminiCooldownUntil) {
    return false;
  }

  if (referenceEmbeddingsGeminiCache.size >= REFERENCE_TEMPLATES.length) {
    return true;
  }

  if (isPrecomputingGemini) return false;
  isPrecomputingGemini = true;

  try {
    for (const t of REFERENCE_TEMPLATES) {
      if (!referenceEmbeddingsGeminiCache.has(t.id)) {
        const vec = await fetchGeminiEmbedding(t.text, apiKey);
        if (vec) {
          referenceEmbeddingsGeminiCache.set(t.id, vec);
        } else {
          // Gemini embedding failed or unsupported; abort loop to allow instant local fallback
          break;
        }
      }
    }
    return referenceEmbeddingsGeminiCache.size > 0;
  } finally {
    isPrecomputingGemini = false;
  }
}

/**
 * Evaluates cosine similarity of an incoming embedding against a specific reference cache.
 * GUARANTEES: Both incoming vector and reference vectors belong to the EXACT same embedding space.
 */
function evaluateCorpusSimilarity(
  incomingEmbedding: number[],
  referenceCache: Map<string, number[]>
): {
  classSimilarities: Record<string, number>;
  clusterDetails: Record<string, { topScore: number; avgScore: number; sampleCount: number }>;
  nearestTemplateId: string | null;
  nearestTemplateTitle: string | null;
  nearestClass: string | null;
  globalTopSim: number;
} {
  const categoryScores: Record<string, number[]> = {
    Phishing: [],
    'Fraud-related': [],
    Impersonated: [],
    Suspicious: [],
    Legitimate: []
  };

  let globalTopSim = 0;
  let nearestTemplateId: string | null = null;
  let nearestTemplateTitle: string | null = null;
  let nearestClass: string | null = null;

  for (const tmpl of REFERENCE_TEMPLATES) {
    const refVec = referenceCache.get(tmpl.id);
    if (!refVec) continue;

    const sim = cosineSimilarity(incomingEmbedding, refVec);
    if (!categoryScores[tmpl.category]) {
      categoryScores[tmpl.category] = [];
    }
    categoryScores[tmpl.category].push(sim);

    if (sim > globalTopSim) {
      globalTopSim = sim;
      nearestTemplateId = tmpl.id;
      nearestTemplateTitle = tmpl.title;
      nearestClass = tmpl.category;
    }
  }

  const classSimilarities: Record<string, number> = {};
  const clusterDetails: Record<string, { topScore: number; avgScore: number; sampleCount: number }> = {};

  for (const [cat, scores] of Object.entries(categoryScores)) {
    if (scores.length === 0) {
      classSimilarities[cat] = 0;
      clusterDetails[cat] = { topScore: 0, avgScore: 0, sampleCount: 0 };
      continue;
    }
    const top = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Weighted blending: 70% top template match + 30% cluster mean
    const blended = parseFloat((top * 0.7 + avg * 0.3).toFixed(4));
    classSimilarities[cat] = blended;
    clusterDetails[cat] = {
      topScore: parseFloat(top.toFixed(4)),
      avgScore: parseFloat(avg.toFixed(4)),
      sampleCount: scores.length
    };
  }

  return {
    classSimilarities,
    clusterDetails,
    nearestTemplateId,
    nearestTemplateTitle,
    nearestClass,
    globalTopSim
  };
}

/**
 * LAYER 1 Main Entry Point:
 * Computes semantic embedding similarity against reference email clusters.
 *
 * Execution Strategy:
 * 1. Primary: Gemini text-embedding-004 (768-d) if GEMINI_API_KEY is available and contactable.
 * 2. Fallback: Local Xenova/all-MiniLM-L6-v2 (384-d) offline embedding pipeline if Gemini is unset, rate-limited, or unavailable.
 *
 * CRITICAL INTEGRITY INVARIANT:
 * Vectors are NEVER compared across different models.
 * If Gemini is active, incoming 768-d vector is evaluated against Gemini 768-d reference cache.
 * If local fallback is active, incoming 384-d vector is evaluated against Local 384-d reference cache.
 */
export async function scoreSemanticSimilarity(text: string): Promise<SemanticSimilarityResult> {
  if (!text || text.trim().length < 15) {
    return {
      status: 'SKIPPED',
      classSimilarities: {
        Phishing: 0,
        'Fraud-related': 0,
        Impersonated: 0,
        Suspicious: 0,
        Legitimate: 0
      },
      nearestTemplate: null,
      nearestClass: null,
      topSimilarity: 0,
      error: 'Insufficient text length for semantic embedding analysis.'
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Track if Gemini fails so we can provide transparent diagnostic reporting
  let geminiFailureReason: string | null = null;

  // ==========================================
  // PATH 1: Primary Gemini text-embedding-004
  // ==========================================
  if (apiKey && apiKey.trim() !== '') {
    try {
      await ensureReferenceEmbeddingsLoaded(apiKey);
      const geminiVector = await fetchGeminiEmbedding(text, apiKey);

      if (geminiVector && geminiVector.length > 0 && referenceEmbeddingsGeminiCache.size > 0) {
        const evalResult = evaluateCorpusSimilarity(geminiVector, referenceEmbeddingsGeminiCache);
        return {
          status: 'AVAILABLE',
          classSimilarities: evalResult.classSimilarities,
          nearestTemplate: evalResult.nearestTemplateId,
          nearestClass: evalResult.nearestClass,
          topSimilarity: parseFloat(evalResult.globalTopSim.toFixed(4)),
          details: {
            clusters: evalResult.clusterDetails,
            nearestTemplateTitle: evalResult.nearestTemplateTitle || undefined,
            model: 'text-embedding-004',
            provider: 'gemini',
            dimension: geminiVector.length,
            fallbackUsed: false
          }
        };
      } else {
        geminiFailureReason = 'Gemini API returned empty or null embedding vector';
      }
    } catch (geminiErr: any) {
      geminiFailureReason = geminiErr?.message || 'Gemini API call failed';
      console.info(`[SemanticEmbedding] Gemini embedding path bypassed (${geminiFailureReason}), using offline local model.`);
    }
  } else {
    geminiFailureReason = 'GEMINI_API_KEY is unset or empty in environment';
  }

  // ==========================================
  // PATH 2: Offline Local all-MiniLM-L6-v2 Fallback
  // ==========================================
  try {
    if (!localExtractor) {
      await initializeLocalEmbeddingModel();
    }

    if (referenceEmbeddingsLocalCache.size < REFERENCE_TEMPLATES.length) {
      await precomputeLocalReferenceEmbeddings();
    }

    const localVector = await embedWithLocalModel(text);

    if (localVector && localVector.length === 384 && referenceEmbeddingsLocalCache.size > 0) {
      const evalResult = evaluateCorpusSimilarity(localVector, referenceEmbeddingsLocalCache);
      return {
        status: 'AVAILABLE',
        classSimilarities: evalResult.classSimilarities,
        nearestTemplate: evalResult.nearestTemplateId,
        nearestClass: evalResult.nearestClass,
        topSimilarity: parseFloat(evalResult.globalTopSim.toFixed(4)),
        details: {
          clusters: evalResult.clusterDetails,
          nearestTemplateTitle: evalResult.nearestTemplateTitle || undefined,
          model: 'Xenova/all-MiniLM-L6-v2 (offline local)',
          provider: 'local_transformers',
          dimension: 384,
          fallbackUsed: true,
          reason: geminiFailureReason || 'Local offline semantic model utilized'
        }
      };
    }
  } catch (localErr: any) {
    console.error('[SemanticEmbedding] Local transformer fallback also failed:', localErr?.message);
  }

  // Both Gemini and Local transformer failed
  return {
    status: 'UNAVAILABLE',
    classSimilarities: {
      Phishing: 0,
      'Fraud-related': 0,
      Impersonated: 0,
      Suspicious: 0,
      Legitimate: 0
    },
    nearestTemplate: null,
    nearestClass: null,
    topSimilarity: 0,
    error: `Semantic similarity unavailable. Gemini: ${geminiFailureReason || 'unavailable'}; Local MiniLM: ${localModelError || 'uninitialized'}`
  };
}
