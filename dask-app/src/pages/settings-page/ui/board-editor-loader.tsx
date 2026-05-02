import { SkeletonColumns } from "@/shared/ui";

export function BoardEditorLoader() {
  return <SkeletonColumns count={4} columnWidth={265} minHeight={360} />;
}
