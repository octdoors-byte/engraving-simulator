import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { appRouter } from "./app/router";
import { seedIfEmpty } from "./domain/seed/seedData";
import { migrateLegacyText } from "./storage/local";
import { getAutoBackupPayload, restoreFromPayload, saveAutoBackup } from "./storage/backup";
import "./styles/global.css";

async function bootstrap() {
  const autoBackup = await getAutoBackupPayload();
  let restored = false;
  if (autoBackup?.localStorage) {
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
  await saveAutoBackup();

  createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RouterProvider router={appRouter} />
    </React.StrictMode>
  );
}

bootstrap();
