import { useEffect } from 'react';
import { NavTab } from '../components/Sidebar';

export interface ShortcutHandlers {
  onOpenCommandPalette?: () => void;
  onNewAnalysis?: () => void;
  onOpenReport?: () => void;
  onOpenPrivacyModal?: () => void;
  onOpenWalkthrough?: () => void;
  onToggleViewMode?: () => void;
  onToggleDemoCases?: () => void;
  onOpenShortcutsHelp?: () => void;
  onSelectTab?: (tab: NavTab) => void;
  onCloseModals?: () => void;
  onLockWorkspace?: () => void;
  enabled?: boolean;
}

export const TAB_SHORTCUT_MAP: Record<string, NavTab> = {
  '1': 'dashboard',
  '2': 'ingest',
  '3': 'cases',
  '4': 'campaigns',
  '5': 'search',
  '6': 'overview',
  '7': 'graph',
  '8': 'map',
  '9': 'gmail',
};

export const SHORTCUT_DEFINITIONS = [
  {
    category: 'Global & Navigation',
    items: [
      { key: '⌘ + K / Ctrl + K', description: 'Open Command Palette & IOC Search' },
      { key: '⌘ + N / Ctrl + N', description: 'Create New Email Forensic Analysis' },
      { key: '⌘ + E / Ctrl + E', description: 'Open Forensic Evidence & PDF Export' },
      { key: '⌘ + J / Ctrl + J', description: 'Toggle View Mode (Standard ↔ Analyst)' },
      { key: '⌘ + / or ?', description: 'Show Keyboard Shortcuts Cheat Sheet' },
      { key: 'Esc', description: 'Close any active modal or command palette' },
    ]
  },
  {
    category: 'Quick Tab Switching',
    items: [
      { key: 'Alt + 1 / ⌘ + 1', description: 'SOC Overview Dashboard' },
      { key: 'Alt + 2 / ⌘ + 2', description: 'RFC 822 Email Ingestion Pipeline' },
      { key: 'Alt + 3 / ⌘ + 3', description: 'Active Cases & Triage' },
      { key: 'Alt + 4 / ⌘ + 4', description: 'Threat Actor Campaigns' },
      { key: 'Alt + 5 / ⌘ + 5', description: 'Forensic Query & IOC Search' },
      { key: 'Alt + 6 / ⌘ + 6', description: 'Case Forensic Overview' },
      { key: 'Alt + 7 / ⌘ + 7', description: 'Threat Relationship Graph' },
      { key: 'Alt + 8 / ⌘ + 8', description: 'IP Geolocation & Route Map' },
      { key: 'Alt + 9 / ⌘ + 9', description: 'Gmail Real-Time Ingest & Watch' },
    ]
  },
  {
    category: 'Forensic Actions',
    items: [
      { key: '⌘ + Shift + L', description: 'Lock Forensic Workspace (NIST AC-11 Auto-Lock)' },
      { key: '⌘ + Shift + D', description: 'Toggle Sample & Demo Cases Feed' },
      { key: '⌘ + Shift + P', description: 'Privacy & Retention Compliance Controls' },
      { key: '⌘ + Shift + O', description: 'Investigation Objective & Role Setup' },
    ]
  }
];

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    if (handlers.enabled === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isMod = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key;

      // Check if user is actively typing in an editable field
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Escape is always allowed to dismiss modals
      if (key === 'Escape') {
        handlers.onCloseModals?.();
        return;
      }

      // Help shortcuts: '?' (Shift + /) when not actively typing
      if (!isTyping && (key === '?' || (isMod && key === '/'))) {
        e.preventDefault();
        handlers.onOpenShortcutsHelp?.();
        return;
      }

      // Global Command / Control shortcuts
      if (isMod) {
        const lowerKey = key.toLowerCase();

        // Cmd/Ctrl + K -> Command Palette / Search
        if (lowerKey === 'k') {
          e.preventDefault();
          handlers.onOpenCommandPalette?.();
          return;
        }

        // Cmd/Ctrl + N -> New Analysis
        if (lowerKey === 'n') {
          e.preventDefault();
          handlers.onNewAnalysis?.();
          return;
        }

        // Cmd/Ctrl + E -> Export Evidence / Report
        if (lowerKey === 'e') {
          e.preventDefault();
          handlers.onOpenReport?.();
          return;
        }

        // Cmd/Ctrl + J -> Toggle View Mode
        if (lowerKey === 'j') {
          e.preventDefault();
          handlers.onToggleViewMode?.();
          return;
        }

        // Cmd/Ctrl + Shift + L -> Lock Workspace
        if (e.shiftKey && lowerKey === 'l') {
          e.preventDefault();
          handlers.onLockWorkspace?.();
          return;
        }

        // Cmd/Ctrl + Shift + D -> Toggle Demo cases
        if (e.shiftKey && lowerKey === 'd') {
          e.preventDefault();
          handlers.onToggleDemoCases?.();
          return;
        }

        // Cmd/Ctrl + Shift + P -> Privacy modal
        if (e.shiftKey && lowerKey === 'p') {
          e.preventDefault();
          handlers.onOpenPrivacyModal?.();
          return;
        }

        // Cmd/Ctrl + Shift + O -> Objective modal
        if (e.shiftKey && lowerKey === 'o') {
          e.preventDefault();
          handlers.onOpenWalkthrough?.();
          return;
        }

        // Cmd/Ctrl + Number (1-9) -> Tab navigation (if not conflicting)
        if (TAB_SHORTCUT_MAP[key]) {
          e.preventDefault();
          handlers.onSelectTab?.(TAB_SHORTCUT_MAP[key]);
          return;
        }
      }

      // Alt + Number (1-9) -> Tab navigation (great alternative on both platforms)
      if (e.altKey && TAB_SHORTCUT_MAP[key]) {
        e.preventDefault();
        handlers.onSelectTab?.(TAB_SHORTCUT_MAP[key]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
