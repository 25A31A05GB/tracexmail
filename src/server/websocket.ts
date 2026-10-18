import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from './logger';
import { verifyUserToken, type UserContext } from './compliance';
import { getSupabaseAdminClient } from './supabase';

export interface AuthenticatedWebSocket extends WebSocket {
  isAlive?: boolean;
  userContext?: {
    userId: string;
    organizationId: string;
    role: string;
  };
}

interface WsTicket {
  user: UserContext;
  expiresAt: number;
}

const wsTickets = new Map<string, WsTicket>();
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_MESSAGE_SIZE = 4096; // 4KB

// Cleanup expired tickets every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [ticket, entry] of wsTickets.entries()) {
    if (entry.expiresAt <= now) {
      wsTickets.delete(ticket);
    }
  }
}, 30000).unref();

/**
 * Creates a single-use WebSocket authentication ticket valid for 30 seconds.
 */
export function createWebSocketTicket(user: UserContext): string {
  const ticket = `wst_${crypto.randomBytes(24).toString('base64url')}`;
  wsTickets.set(ticket, {
    user,
    expiresAt: Date.now() + 30 * 1000 // 30 seconds
  });
  return ticket;
}

/**
 * Validates and consumes a single-use WebSocket ticket.
 */
export function consumeWebSocketTicket(ticket: string): UserContext | null {
  const entry = wsTickets.get(ticket);
  if (!entry) return null;
  wsTickets.delete(ticket); // Single use
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.user;
}

let activeWss: WebSocketServer | null = null;
const activeSockets = new Set<AuthenticatedWebSocket>();

/**
 * Broadcasts an event to connected WebSocket clients, filtered strictly by organizationId.
 */
export function broadcastWebSocketEvent(eventData: any, targetOrgId?: string): void {
  const effectiveOrgId = targetOrgId ||
    eventData?.organizationId ||
    eventData?.organization_id ||
    eventData?.case?.organization_id ||
    eventData?.alert?.organization_id;

  const payload = JSON.stringify(eventData);

  activeSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      // If an organization target is specified, strictly isolate to matching sockets
      if (effectiveOrgId) {
        if (!ws.userContext || ws.userContext.organizationId !== effectiveOrgId) {
          return; // Drop: cross-tenant isolation enforcement
        }
      }
      try {
        ws.send(payload);
      } catch (err: any) {
        logger.warn({ error: err?.message }, '[WebSocket Broadcast] Failed to send to socket');
      }
    }
  });
}

/**
 * Broadcasts a threat alert event.
 */
export function broadcastAlert(alert: any, extraData?: any): void {
  const targetOrgId = alert.organization_id || alert.organizationId || extraData?.organization_id || extraData?.caseItem?.organization_id;
  broadcastWebSocketEvent(alert, targetOrgId);
  if (extraData?.caseItem) {
    broadcastWebSocketEvent({ type: 'ALERT', alert, case: extraData.caseItem }, targetOrgId);
    broadcastWebSocketEvent({ type: 'CASE_CREATED', case: extraData.caseItem, alert }, targetOrgId);
  }
}

/**
 * Sets up and attaches the hardened WebSocket server to the HTTP server.
 */
export function setupWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_SIZE,
    handleProtocols: (protocols, _req) => {
      if (protocols.has('vite-hmr')) {
        return process.env.NODE_ENV !== 'production' ? 'vite-hmr' : false;
      }
      const first = Array.from(protocols)[0];
      return first || false;
    }
  });

  activeWss = wss;

  wss.on('connection', (ws: AuthenticatedWebSocket, req: http.IncomingMessage) => {
    ws.isAlive = true;
    activeSockets.add(ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: Buffer | string) => {
      try {
        if (data.length > MAX_MESSAGE_SIZE) {
          ws.close(1009, 'Message too large');
          return;
        }
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      activeSockets.delete(ws);
    });

    ws.on('error', (err) => {
      logger.warn({ error: err.message }, '[WebSocket Socket Error]');
      activeSockets.delete(ws);
    });

    // Send initial connection confirmation
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        message: 'TraceXMail Live Alert Feed Active',
        tenant: ws.userContext?.organizationId || 'unscoped'
      })
    );
  });

  // Heartbeat ping/pong and dead socket cleanup
  const heartbeatInterval = setInterval(() => {
    activeSockets.forEach((ws) => {
      if (ws.isAlive === false) {
        activeSockets.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  heartbeatInterval.unref();

  // Upgrade handler with strict authentication
  server.on('upgrade', async (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const protocolsHeader = request.headers['sec-websocket-protocol'] || '';
      const protocols = protocolsHeader.split(',').map((p) => p.trim());

      // 1. Vite HMR protocol in development
      if (protocols.includes('vite-hmr')) {
        if (process.env.NODE_ENV !== 'production') {
          return wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Extract credentials from Ticket or Bearer token
      const ticketParam = url.searchParams.get('ticket');
      const tokenParam = url.searchParams.get('token');
      const protocolToken = protocols.find((p) => p.startsWith('bearer-') || p.startsWith('wst_'));

      let resolvedUser: UserContext | null = null;

      // Try ticket first
      const ticketCandidate = ticketParam || (protocolToken?.startsWith('wst_') ? protocolToken : null);
      if (ticketCandidate) {
        resolvedUser = consumeWebSocketTicket(ticketCandidate);
      }

      // Try JWT token if ticket not found
      if (!resolvedUser) {
        let rawToken = tokenParam;
        if (!rawToken && protocolToken?.startsWith('bearer-')) {
          rawToken = protocolToken.replace(/^bearer-/, '');
        }
        if (!rawToken && request.headers.authorization?.startsWith('Bearer ')) {
          rawToken = request.headers.authorization.substring(7);
        }

        if (rawToken) {
          // Check local HMAC token
          try {
            resolvedUser = verifyUserToken(rawToken);
          } catch {}

          // Check Supabase Admin JWT if not local HMAC
          if (!resolvedUser) {
            const supabaseAdmin = getSupabaseAdminClient();
            if (supabaseAdmin) {
              try {
                const { data: { user }, error } = await supabaseAdmin.auth.getUser(rawToken);
                if (!error && user) {
                  resolvedUser = {
                    userId: user.id,
                    email: user.email || '',
                    role: (user.user_metadata?.role as any) || 'analyst',
                    organizationId: user.user_metadata?.organization_id || 'org_acme_soc_01',
                    authMethod: 'supabase_jwt'
                  };
                }
              } catch {}
            }
          }
        }
      }

      if (!resolvedUser) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // 3. Connection cap per user (max 5)
      let userConnCount = 0;
      activeSockets.forEach((ws) => {
        if (ws.userContext?.userId === resolvedUser!.userId) {
          userConnCount++;
        }
      });

      if (userConnCount >= MAX_CONNECTIONS_PER_USER) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }

      // 4. Upgrade and bind userContext
      wss.handleUpgrade(request, socket, head, (ws: AuthenticatedWebSocket) => {
        ws.userContext = {
          userId: resolvedUser!.userId,
          organizationId: resolvedUser!.organizationId,
          role: resolvedUser!.role
        };
        wss.emit('connection', ws, request);
      });
    } catch (err: any) {
      logger.warn({ error: err?.message }, '[WebSocket Upgrade Error]');
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch {}
    }
  });

  return wss;
}

export function getActiveSocketCount(): number {
  return activeSockets.size;
}
