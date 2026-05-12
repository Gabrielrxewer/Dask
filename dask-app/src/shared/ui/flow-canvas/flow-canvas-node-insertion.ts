import type { Node, XYPosition } from "@xyflow/react";

export interface FlowCanvasPaletteItem<TKind extends string, TData extends Record<string, unknown>> {
  kind: TKind;
  label: string;
  description: string;
  color: string;
  buildData: () => TData;
  deletable?: boolean;
}

export function createFlowCanvasNode<TData extends Record<string, unknown>, TKind extends string>(
  item: FlowCanvasPaletteItem<TKind, TData>,
  position: XYPosition,
  id = `${item.kind}-${Date.now()}`
): Node<TData, TKind> {
  return {
    id,
    type: item.kind,
    position,
    data: item.buildData(),
    deletable: item.deletable ?? true
  };
}
