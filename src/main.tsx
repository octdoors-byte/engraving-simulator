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
  if (autoBackup) {
    await restoreFromPayload(autoBackup);
  } else {
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
