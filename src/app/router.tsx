import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layout/AppLayout";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AdminDesignsPage } from "@/pages/admin/AdminDesignsPage";
import { CommonInfoPage as AdminCommonInfoPage } from "@/pages/admin/CommonInfoPage";
import { AdminTemplatesPage } from "@/pages/admin/AdminTemplatesPage";
import { PageNotFound } from "@/pages/common/PageNotFound";
import { CommonInfoPage } from "@/pages/common/CommonInfoPage";
import { SimLandingPage } from "@/pages/sim/SimLandingPage";
import { SimPage } from "@/pages/sim/SimPage";
import { CategoryLandingPage } from "@/pages/sim/CategoryLandingPage";

const basePath = import.meta.env.BASE_URL || "/";

export const appRouter = createBrowserRouter(
  [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <PageNotFound />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/designs" replace />
      },
      {
        path: "top",
        element: <SimLandingPage />
      },
      {
        path: "categories",
        element: <CategoryLandingPage />
      },
      {
        path: "common",
        element: <CommonInfoPage />
      },
      {
        path: "sim/:templateKey",
        element: <SimPage />
      },
      {
        path: "admin/templates",
        element: (
          <ErrorBoundary title="テンプレート管理でエラーが発生しました。">
            <AdminTemplatesPage />
          </ErrorBoundary>
        )
      },
      {
        path: "admin/designs",
        element: (
          <ErrorBoundary title="作成履歴の読み込みでエラーが発生しました。">
            <AdminDesignsPage />
          </ErrorBoundary>
        )
      },
      {
        path: "admin/common",
        element: (
          <ErrorBoundary title="共通説明ページでエラーが発生しました。">
            <AdminCommonInfoPage />
          </ErrorBoundary>
        )
      }
    ]
  }
  ],
  {
    basename: basePath
  }
);
