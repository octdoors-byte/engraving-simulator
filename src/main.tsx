import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { appRouter } from "./app/router";
import { seedIfEmpty } from "./domain/seed/seedData";
import { migrateLegacyText } from "./storage/local";
import { getAutoBackupPayload, restoreFromPayload, saveAutoBackup } from "./storage/backup";
import "./styles/global.css";

function BootstrapApp() {
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      console.error("bootstrap timeout");
      setReady(true);
    }, 8000);
    const run = async () => {
      try {
        const autoBackup = await getAutoBackupPayload();
        const hasLocalData = Object.keys(localStorage).some((key) => key.startsWith("ksim:"));
        let restored = false;
        if (!hasLocalData && autoBackup?.localStorage) {
          const rawIndex = autoBackup.localStorage["ksim:templates:index"];
          if (rawIndex) {
            try {
              const list = JSON.parse(rawIndex);
              if (Array.isArray(list) && list.length > 0) {
                await restoreFromPayload(autoBackup);
                restored = true;
              }
            } catch (error) {
              console.error(error);
            }
          }
        }
        if (!restored) {
          await seedIfEmpty("ifEmpty");
        }
        migrateLegacyText();
      } catch (error) {
        console.error("bootstrap failed", error);
      } finally {
        window.clearTimeout(timeoutId);
        setReady(true);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const handleBackup = () => {
      saveAutoBackup().catch((error) => {
        console.error("auto backup failed", error);
      });
    };
    window.addEventListener("pagehide", handleBackup);
    window.addEventListener("beforeunload", handleBackup);
    return () => {
      window.removeEventListener("pagehide", handleBackup);
      window.removeEventListener("beforeunload", handleBackup);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  return <RouterProvider router={appRouter} />;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <BootstrapApp />
    </React.StrictMode>
  );
}
