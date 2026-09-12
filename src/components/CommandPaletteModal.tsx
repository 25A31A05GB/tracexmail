import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Plus,
  FileDown,
  SlidersHorizontal,
  Scale,
  Compass,
  LayoutDashboard,
  Upload,
  FolderOpen,
  Layers,
  Activity,
  Network,
  MapPin,
  Mail,
  Bell,
  Terminal,
  FileText,
  Building2,
  Users,
  Settings,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  X,
  Keyboard,
  Globe,
  Database
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { EmailAnalysis } from '../types';
import { SAMPLE_ANALYSES } from '../data/samples';
import { getStandardizedVerdict } from '../utils/verdict';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavTab) => void;
  onNewAnalysis: () => void;
  onOpenReport: () => void;
  onOpenPrivacyModal?: () => void;
  onOpenWalkthrough?: () => void;
  onToggleViewMode?: () => void;
  onToggleDemoCases?: () => void;
  onOpenShortcutsHelp?: () => void;
  onSelectAnalysis: (analysis: EmailAnalysis) => void;
  currentAnalysis?: EmailAnalysis;
  viewMode?: 'simple' | 'analyst';
  showDemoCases?: boolean;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Actions' | 'Navigation' | 'Cases' | 'Tools';
  icon: React.ElementType;
  shortcut?: string;
  badge?: { label: string; color: string };
  action: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onSelectTab,
  onNewAnalysis,
  onOpenReport,
  onOpenPrivacyModal,
  onOpenWalkthrough,
  onToggleViewMode,
  onToggleDemoCases,
  onOpenShortcutsHelp,
  onSelectAnalysis,
  currentAnalysis,
  viewMode = 'simple',
  showDemoCases = false
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modSymbol = isMac ? '⌘' : 'Ctrl';

  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // 1. Quick Actions
      {
        id: 'action-new-analysis',
        title: 'New Email Forensic Analysis',
        subtitle: 'Ingest raw RFC 822 email, headers, or upload .eml file',
        category: 'Actions',
        icon: Plus,
        shortcut: `${modSymbol}N`,
        action: () => {
          onClose();
          onNewAnalysis();
        }
      },
      {
        id: 'action-export-report',
        title: 'Export Forensic Evidence & PDF',
        subtitle: 'Generate cryptographic audit dossier & compliance report',
        category: 'Actions',
        icon: FileDown,
        shortcut: `${modSymbol}E`,
        action: () => {
          onClose();
          onOpenReport();
        }
      },
      {
        id: 'action-toggle-mode',
        title: `Switch View Mode: ${viewMode === 'simple' ? 'Analyst Deep Dive' : 'Standard Clean View'}`,
        subtitle: `Currently in ${viewMode === 'simple' ? 'Standard' : 'Analyst'} console mode`,
        category: 'Actions',
        icon: SlidersHorizontal,
        shortcut: `${modSymbol}J`,
        action: () => {
          onClose();
          onToggleViewMode?.();
        }
      },
      {
        id: 'action-shortcuts-help',
        title: 'Keyboard Shortcuts Cheat Sheet',
        subtitle: 'View all power user navigation and triage keybindings',
        category: 'Actions',
        icon: Keyboard,
        shortcut: '?',
        action: () => {
          onClose();
          onOpenShortcutsHelp?.();
        }
      },
      {
        id: 'action-privacy-compliance',
        title: 'Privacy Safeguards & PII Masking',
        subtitle: 'Configure automated header redaction and retention policy',
        category: 'Actions',
        icon: Scale,
        shortcut: `${modSymbol}⇧P`,
        action: () => {
          onClose();
          onOpenPrivacyModal?.();
        }
      },
      {
        id: 'action-investigation-objective',
        title: 'Investigation Goal & Objective Setup',
        subtitle: 'Tailor enclave workspace for BEC, Phishing, or Spoofing',
        category: 'Actions',
        icon: Compass,
        shortcut: `${modSymbol}⇧O`,
        action: () => {
          onClose();
          onOpenWalkthrough?.();
        }
      },
      {
        id: 'action-toggle-demo',
        title: `${showDemoCases ? 'Hide' : 'Show'} Synthetic Demo Cases Feed`,
        subtitle: 'Toggle benchmark datasets and synthetic triage samples',
        category: 'Actions',
        icon: Database,
        shortcut: `${modSymbol}⇧D`,
        action: () => {
          onClose();
          onToggleDemoCases?.();
        }
      },

      // 2. Navigation Tabs
      {
        id: 'nav-dashboard',
        title: 'SOC Dashboard',
        subtitle: 'Telemetry, active cases, and fraud score matrix',
        category: 'Navigation',
        icon: LayoutDashboard,
        shortcut: `${modSymbol}1`,
        action: () => {
          onClose();
          onSelectTab('dashboard');
        }
      },
      {
        id: 'nav-ingest',
        title: 'Ingestion Pipeline & Upload',
        subtitle: 'Parse RFC 822 emails, headers, and attachments',
        category: 'Navigation',
        icon: Upload,
        shortcut: `${modSymbol}2`,
        action: () => {
          onClose();
          onSelectTab('ingest');
        }
      },
      {
        id: 'nav-cases',
        title: 'Forensic Cases & Triage Queue',
        subtitle: 'Priority-ranked incident repository and case logs',
        category: 'Navigation',
        icon: FolderOpen,
        shortcut: `${modSymbol}3`,
        action: () => {
          onClose();
          onSelectTab('cases');
        }
      },
      {
        id: 'nav-campaigns',
        title: 'Threat Actor Campaigns',
        subtitle: 'Cluster analysis and coordinated threat infrastructure',
        category: 'Navigation',
        icon: Layers,
        shortcut: `${modSymbol}4`,
        action: () => {
          onClose();
          onSelectTab('campaigns');
        }
      },
      {
        id: 'nav-search',
        title: 'Forensic Query & IOC Search',
        subtitle: 'Query IPs, domains, hashes, and email headers',
        category: 'Navigation',
        icon: Search,
        shortcut: `${modSymbol}5`,
        action: () => {
          onClose();
          onSelectTab('search');
        }
      },
      {
        id: 'nav-overview',
        title: 'Case Forensic Overview',
        subtitle: 'Comprehensive breakdown, hops, and risk gauges',
        category: 'Navigation',
        icon: Activity,
        shortcut: `${modSymbol}6`,
        action: () => {
          onClose();
          onSelectTab('overview');
        }
      },
      {
        id: 'nav-graph',
        title: 'Threat Relationship Graph',
        subtitle: 'Interactive node network of actors, domains, and IPs',
        category: 'Navigation',
        icon: Network,
        shortcut: `${modSymbol}7`,
        action: () => {
          onClose();
          onSelectTab('graph');
        }
      },
      {
        id: 'nav-map',
        title: 'IP Geolocation & Hop Route Map',
        subtitle: 'Geographic hops trace and originating relays',
        category: 'Navigation',
        icon: MapPin,
        shortcut: `${modSymbol}8`,
        action: () => {
          onClose();
          onSelectTab('map');
        }
      },
      {
        id: 'nav-gmail',
        title: 'Gmail Real-Time Ingest & Watch',
        subtitle: 'Cloud Pub/Sub push subscription and inbox monitoring',
        category: 'Navigation',
        icon: Mail,
        shortcut: `${modSymbol}9`,
        action: () => {
          onClose();
          onSelectTab('gmail');
        }
      },
      {
        id: 'nav-alerts',
        title: 'Real-Time Alert Feed',
        subtitle: 'Live WebSocket security notifications and triggers',
        category: 'Navigation',
        icon: Bell,
        action: () => {
          onClose();
          onSelectTab('alerts');
        }
      },
      {
        id: 'nav-logs',
        title: 'Threat & Authentication Logs',
        subtitle: 'SPF, DKIM, DMARC, ARC cryptographic events',
        category: 'Navigation',
        icon: Terminal,
        action: () => {
          onClose();
          onSelectTab('logs');
        }
      },
      {
        id: 'nav-headers',
        title: 'Raw RFC 822 Headers',
        subtitle: 'Direct header inspection and syntax highlighting',
        category: 'Navigation',
        icon: FileText,
        action: () => {
          onClose();
          onSelectTab('headers');
        }
      },
      {
        id: 'nav-organization',
        title: 'Organization Profile & Tenancy',
        subtitle: 'Enterprise SOC settings and compliance controls',
        category: 'Navigation',
        icon: Building2,
        action: () => {
          onClose();
          onSelectTab('organization');
        }
      },
      {
        id: 'nav-team',
        title: 'SOC Team & Access Control',
        subtitle: 'RBAC clearance, analyst profiles, and audit records',
        category: 'Navigation',
        icon: Users,
        action: () => {
          onClose();
          onSelectTab('team');
        }
      },
      {
        id: 'nav-settings',
        title: 'Account & Security Settings',
        subtitle: 'MFA credentials, session locks, and preferences',
        category: 'Navigation',
        icon: Settings,
        action: () => {
          onClose();
          onSelectTab('settings');
        }
      }
    ];

    // 3. Preset Forensic Cases
    SAMPLE_ANALYSES.forEach((sample) => {
      const v = getStandardizedVerdict(sample);
      const isPhish = v.category === 'MALICIOUS';
      const isSuspicious = v.category === 'SUSPICIOUS';

      items.push({
        id: `case-${sample.id}`,
        title: sample.subject || 'Forensic Case',
        subtitle: `From: ${sample.from} • Threat: ${sample.threatScore || 0}/100 • ID: ${sample.id}`,
        category: 'Cases',
        icon: isPhish ? ShieldAlert : isSuspicious ? AlertTriangle : ShieldCheck,
        badge: {
          label: `${sample.threatScore || 0}/100 ${v.verdict}`,
          color: isPhish
            ? 'bg-red-500/20 text-red-400 border-red-500/30'
            : isSuspicious
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
        },
        action: () => {
          onClose();
          onSelectAnalysis(sample);
          onSelectTab('overview');
        }
      });
    });

    return items;
  }, [
    modSymbol,
    viewMode,
    showDemoCases,
    onClose,
    onNewAnalysis,
    onOpenReport,
    onToggleViewMode,
    onOpenShortcutsHelp,
    onOpenPrivacyModal,
    onOpenWalkthrough,
    onToggleDemoCases,
    onSelectTab,
    onSelectAnalysis
  ]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;

    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.shortcut?.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Keep selected index within range
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-[#16130f] border border-[#3a352c] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col z-10"
        >
          {/* Header / Input Field */}
          <div className="flex items-center px-4 py-3.5 border-b border-[#3a352c] bg-[#1a1712]">
            <Search className="w-5 h-5 text-amber-400 shrink-0 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command, search cases, jump to views, or query IOCs..."
              className="w-full bg-transparent text-[#ede6d8] placeholder-[#7d7363] text-sm focus:outline-none font-sans"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-[#8a8070] hover:text-[#ede6d8] p-1 transition-colors mr-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold bg-[#26211a] border border-[#3a352c] rounded text-[#8a8070]">
              ESC
            </kbd>
          </div>

          {/* Items List */}
          <div
            ref={listRef}
            className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-[#26211a]/40"
          >
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-[#8a8070]">
                <Search className="w-8 h-8 mx-auto mb-2 text-[#5e5548] opacity-50" />
                <p className="text-sm font-medium text-[#ede6d8]">No matching commands or cases found</p>
                <p className="text-xs mt-1 text-[#8a8070]">
                  Press <kbd className="px-1.5 py-0.5 bg-[#26211a] border border-[#3a352c] rounded text-[10px] font-mono">5</kbd> to open deep forensic search
                </p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={item.id}
                    data-active={isSelected}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border border-amber-500/40 text-[#ede6d8]'
                        : 'hover:bg-[#221e17] text-[#b9af9c] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                            : 'bg-[#1f1b15] border-[#3a352c] text-[#8a8070]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold truncate ${
                              isSelected ? 'text-[#ede6d8]' : 'text-[#d6cdbe]'
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.badge && (
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded border font-mono font-bold shrink-0 ${item.badge.color}`}
                            >
                              {item.badge.label}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-[#7d7363] truncate font-sans">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {item.shortcut && (
                        <kbd
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-[#1f1b15] border-[#3a352c] text-[#8a8070]'
                          }`}
                        >
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && <ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 bg-[#14120f] border-t border-[#3a352c] flex items-center justify-between text-[11px] text-[#7d7363]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#26211a] border border-[#3a352c] rounded text-[9.5px] font-mono">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#26211a] border border-[#3a352c] rounded text-[9.5px] font-mono">↵</kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#26211a] border border-[#3a352c] rounded text-[9.5px] font-mono">Esc</kbd>
                <span>Close</span>
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10.5px] font-mono text-[#8a8070]">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>TraceXMail Enclave Command Deck</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
