import { SkeletonBlock, SkeletonLayout } from "@/shared/ui";

export function WorkItemEditorLoadingState() {
  return (
    <SkeletonLayout className="wie__loading shared-fill-container" direction="row" gap={10}>
      <SkeletonBlock flex="0 0 240px" minHeight={200} />
      <SkeletonBlock flex={1} minHeight={200} />
      <SkeletonBlock flex="0 0 280px" minHeight={200} />
    </SkeletonLayout>
  );
}
