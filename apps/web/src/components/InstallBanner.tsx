import { useEffect, useState } from "react";
import { InstallInstructionsModal } from "./InstallInstructionsModal";

const INSTALLED_KEY = "shard-tracker-pwa-installed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true
  );
}

function isInstalled() {
  return isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true";
}

function markInstalled() {
  localStorage.setItem(INSTALLED_KEY, "true");
}

function detectPlatform(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function InstallBanner() {
  const [visible, setVisible] = useState(() => !isInstalled());
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    function handleInstalled() {
      markInstalled();
      setVisible(false);
    }
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  if (!visible) return null;

  const dismiss = () => setVisible(false);

  return (
    <>
      <div className="relative mb-4 flex flex-col gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 pr-10 sm:mb-6 sm:flex-row sm:items-center sm:gap-4 sm:pr-4">
        <div className="flex items-center gap-3 sm:flex-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
            <DownloadIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">
              Přidejte si Shard Tracker na plochu
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Načítá se bleskově rychle a funguje jako plnohodnotná mobilní
              aplikace.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowInstructions(true)}
          className="h-9 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3.5 text-sm font-medium text-blue-200 hover:bg-blue-500/25 sm:shrink-0"
        >
          Jak na to
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zavřít"
          className="absolute top-2 right-2 rounded-md p-1.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-300 sm:static sm:shrink-0"
        >
          <CloseIcon />
        </button>
      </div>

      {showInstructions && (
        <InstallInstructionsModal
          defaultPlatform={detectPlatform()}
          onClose={() => setShowInstructions(false)}
        />
      )}
    </>
  );
}
