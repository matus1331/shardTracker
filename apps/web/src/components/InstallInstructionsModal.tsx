import { useState } from 'react';

type Platform = 'ios' | 'android' | 'desktop';

interface InstallInstructionsModalProps {
  defaultPlatform: Platform;
  onClose: () => void;
}

const PLATFORM_ORDER: Platform[] = ['ios', 'android', 'desktop'];

const PLATFORM_LABELS: Record<Platform, string> = {
  ios: 'iOS',
  android: 'Android',
  desktop: 'Počítač',
};

const PLATFORM_CONTENT: Record<Platform, { title: string; steps: string[] }> = {
  ios: {
    title: 'iOS (Safari)',
    steps: [
      'Otevřete Shard Tracker v prohlížeči Safari — instalace funguje jen odsud, ne z Chromu.',
      'Klepněte na ikonu Sdílet ve spodní liště prohlížeče.',
      'V nabídce, která se otevře, vyberte „Přidat na plochu“.',
      'Potvrďte klepnutím na „Přidat“ vpravo nahoře.',
    ],
  },
  android: {
    title: 'Android (Chrome)',
    steps: [
      'Otevřete Shard Tracker v prohlížeči Chrome.',
      'Klepněte na nabídku se třemi tečkami vpravo nahoře.',
      'Vyberte „Přidat na plochu“ nebo „Instalovat aplikaci“.',
      'Potvrďte klepnutím na „Instalovat“.',
    ],
  },
  desktop: {
    title: 'Počítač (Chrome / Edge)',
    steps: [
      'Otevřete Shard Tracker v prohlížeči Chrome nebo Edge.',
      'Klikněte na ikonu instalace v adresním řádku (nebo na nabídku ⋮ vpravo nahoře).',
      'Vyberte „Nainstalovat Shard Tracker…“.',
      'Potvrďte kliknutím na „Nainstalovat“ v dialogu.',
    ],
  },
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" strokeLinecap="round" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: Platform }) {
  return platform === 'desktop' ? <MonitorIcon /> : <PhoneIcon />;
}

export function InstallInstructionsModal({ defaultPlatform, onClose }: InstallInstructionsModalProps) {
  const [platform, setPlatform] = useState<Platform>(defaultPlatform);
  const active = PLATFORM_CONTENT[platform];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-100">Jak nainstalovat aplikaci</p>
            <p className="mt-0.5 text-xs text-slate-400">Vyberte své zařízení a postupujte podle kroků</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-300"
          >
            <CloseIcon />
          </button>
        </div>

        <div role="tablist" className="mb-4 flex gap-1.5 rounded-lg bg-slate-800/70 p-1">
          {PLATFORM_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={platform === p}
              onClick={() => setPlatform(p)}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                platform === p ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PlatformIcon platform={p} />
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>

        <p className="mb-3 text-sm font-medium text-slate-200">{active.title}</p>
        <ol className="space-y-3">
          {active.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-300">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-9 w-full rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 hover:bg-slate-700"
        >
          Rozumím
        </button>
      </div>
    </div>
  );
}
