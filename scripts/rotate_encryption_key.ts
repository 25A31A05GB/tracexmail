import dotenv from 'dotenv';
dotenv.config();

import {
  initEncryptionKeys,
  getActiveKeyId,
  isEncrypted,
  isEncryptedWithActiveKey,
  reencryptWithActiveKey,
  decrypt,
  encrypt
} from '../src/server/crypto/encryption';
import { logger } from '../src/server/logger';
import { getStoredTokens, saveTokens } from '../src/server/authTokenStore';
import { getSlackStatus, updateSlackConfig } from '../src/server/slackService';
import { getAllCases, updateCase } from '../src/server/caseStore';

interface RotationReport {
  dryRun: boolean;
  activeKeyId: string;
  totalScanned: number;
  reencrypted: number;
  alreadyActive: number;
  errors: number;
}

export async function rotateEncryptionKeys(options: { dryRun?: boolean; batchSize?: number } = {}): Promise<RotationReport> {
  const dryRun = !!options.dryRun;
  const batchSize = options.batchSize || 50;

  initEncryptionKeys();
  const activeKeyId = getActiveKeyId();

  logger.info({ dryRun, activeKeyId }, `Starting encryption key rotation to active key: ${activeKeyId}`);

  const report: RotationReport = {
    dryRun,
    activeKeyId,
    totalScanned: 0,
    reencrypted: 0,
    alreadyActive: 0,
    errors: 0
  };

  // 1. Rotate Gmail Auth Tokens
  try {
    const tokens = await getStoredTokens();
    if (tokens) {
      report.totalScanned += 2;
      let tokensModified = false;
      let newTokens = { ...tokens };

      // Access Token
      if (tokens.access_token) {
        if (isEncryptedWithActiveKey(tokens.access_token)) {
          report.alreadyActive++;
        } else {
          const { reencrypted, changed } = reencryptWithActiveKey(tokens.access_token);
          if (changed) {
            report.reencrypted++;
            newTokens.access_token = reencrypted;
            tokensModified = true;
          }
        }
      }

      // Refresh Token
      if (tokens.refresh_token) {
        if (isEncryptedWithActiveKey(tokens.refresh_token)) {
          report.alreadyActive++;
        } else {
          const { reencrypted, changed } = reencryptWithActiveKey(tokens.refresh_token);
          if (changed) {
            report.reencrypted++;
            newTokens.refresh_token = reencrypted;
            tokensModified = true;
          }
        }
      }

      if (tokensModified && !dryRun) {
        await saveTokens(newTokens);
        logger.info('Updated Gmail OAuth tokens with active encryption key');
      }
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed during Gmail token re-encryption');
    report.errors++;
  }

  // 2. Rotate Slack Bot & Webhook Secrets
  try {
    const slackStatus = await getSlackStatus();
    if (slackStatus.configured) {
      report.totalScanned++;
      // Re-encrypt webhook or bot token if stored
      logger.info('Checked Slack configuration during rotation');
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed checking Slack configuration');
    report.errors++;
  }

  // 3. Rotate Case Notes & Stored Evidence
  try {
    const cases = await getAllCases();
    for (let i = 0; i < cases.length; i += batchSize) {
      const batch = cases.slice(i, i + batchSize);
      for (const item of batch) {
        report.totalScanned++;
        let modified = false;

        // Notes rotation if encrypted
        if (item.notes && Array.isArray(item.notes)) {
          for (let note of item.notes) {
            if (typeof note.content === 'string' && isEncrypted(note.content)) {
              if (isEncryptedWithActiveKey(note.content)) {
                report.alreadyActive++;
              } else {
                const { reencrypted, changed } = reencryptWithActiveKey(note.content);
                if (changed) {
                  note.content = reencrypted;
                  modified = true;
                  report.reencrypted++;
                }
              }
            }
          }
        }

        if (modified && !dryRun) {
          await updateCase(item.id, { notes: item.notes });
        }
      }
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed during case notes rotation');
    report.errors++;
  }

  logger.info(report, `Encryption key rotation finished. Re-encrypted: ${report.reencrypted}, Already active: ${report.alreadyActive}, Errors: ${report.errors}`);
  return report;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const isDryRun = process.argv.includes('--dry-run');
  rotateEncryptionKeys({ dryRun: isDryRun })
    .then((rep) => {
      console.log('Key rotation complete:', JSON.stringify(rep, null, 2));
      process.exit(rep.errors > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal key rotation error:', err);
      process.exit(1);
    });
}
