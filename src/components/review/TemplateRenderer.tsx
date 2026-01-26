import type { Review, TemplateId } from "@/domain/review/types";
import { Template1 } from "./Template1";
import { Template2 } from "./Template2";
import { Template3 } from "./Template3";
import { Template4 } from "./Template4";
import { Template5 } from "./Template5";

interface TemplateRendererProps {
  review: Review;
  templateId: TemplateId;
  backgroundImage?: string;
}

export function TemplateRenderer({
  review,
  templateId,
  backgroundImage
}: TemplateRendererProps) {
  switch (templateId) {
    case "template-1":
      return <Template1 review={review} backgroundImage={backgroundImage} />;
    case "template-2":
      return <Template2 review={review} backgroundImage={backgroundImage} />;
    case "template-3":
      return <Template3 review={review} backgroundImage={backgroundImage} />;
    case "template-4":
      return <Template4 review={review} backgroundImage={backgroundImage} />;
    case "template-5":
      return <Template5 review={review} backgroundImage={backgroundImage} />;
    default:
      return <Template1 review={review} backgroundImage={backgroundImage} />;
  }
}
