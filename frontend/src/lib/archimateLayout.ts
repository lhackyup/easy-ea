import { ArchimateElementItem, ArchimateRelationshipItem } from '../types';

export interface LayoutOptions {
  mode: 'layered' | 'nested' | 'compact' | 'original';
  horizontalSpacing?: number;
  verticalSpacing?: number;
  containerPadding?: number;
}

export const ARCHIMATE_LAYER_ORDER: Record<string, number> = {
  strategy: 0,
  business: 1,
  application: 2,
  technology: 3,
  physical: 4,
  motivation: 5,
  implementation: 6,
  other: 7
};

export const ARCHIMATE_LAYER_LABELS: Record<string, string> = {
  strategy: 'Strategy Layer',
  business: 'Business Layer',
  application: 'Application Layer',
  technology: 'Technology Layer',
  physical: 'Physical Layer',
  motivation: 'Motivation Layer',
  implementation: 'Implementation & Migration',
  other: 'Other Elements'
};

export interface ProcessedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  parentId?: string;
  style?: React.CSSProperties;
  data: {
    label: string;
    type: string;
    layer: string;
    documentation?: string;
    properties?: Record<string, any>;
    rawElement?: ArchimateElementItem;
    isSelected?: boolean;
    isContainer?: boolean;
    isLayerSwimlane?: boolean;
    isDimmed?: boolean;
    childrenCount?: number;
  };
}

export interface ProcessedEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  relType?: string;
  data?: any;
  markerStart?: string;
  markerEnd?: string;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  labelBgStyle?: React.CSSProperties;
  animated?: boolean;
}

/**
 * Computes an organized, non-overlapping ArchiMate layout supporting:
 * 1. Semantic Layer Swimlanes (Strategy -> Business -> Application -> Technology -> ...)
 * 2. Nested ArchiMate Containers (Composition, Aggregation, Assignment, or parent_id)
 * 3. Overlap avoidance with dynamic node sizing and topological ordering
 */
export function computeArchiMateLayout(
  rawNodes: any[],
  rawConns: any[],
  elementLookup: Map<string, ArchimateElementItem>,
  relationshipLookup: Map<string, ArchimateRelationshipItem>,
  options: LayoutOptions = { mode: 'layered' }
): { nodes: ProcessedNode[]; edges: ProcessedEdge[] } {
  if (!rawNodes || rawNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // 1. Build Node Meta Information
  interface NodeMeta {
    id: string;
    raw: any;
    elementId: string;
    label: string;
    type: string;
    layer: string;
    documentation: string;
    properties: Record<string, any>;
    rawElement?: ArchimateElementItem;
    specifiedParentId: string | null;
    inferredParentId: string | null;
    finalParentId: string | null;
    width: number;
    height: number;
    x: number;
    y: number;
  }

  const nodeMap = new Map<string, NodeMeta>();
  const elementIdToNodeId = new Map<string, string>();

  rawNodes.forEach((n, idx) => {
    const elId = n.element_id || '';
    const el = elId ? elementLookup.get(elId) : null;
    const label = el ? el.name : (n.name || elId || `Element ${idx + 1}`);
    const type = el ? el.type : (n.type || 'ApplicationComponent');
    const layer = (el ? el.layer : (n.layer || 'Application')).toLowerCase().trim();
    const nodeId = n.id || `node-${idx}`;

    const width = Number(n.width) && Number(n.width) >= 150 ? Number(n.width) : 190;
    const height = Number(n.height) && Number(n.height) >= 60 ? Number(n.height) : 70;

    nodeMap.set(nodeId, {
      id: nodeId,
      raw: n,
      elementId: elId,
      label,
      type,
      layer,
      documentation: el?.documentation || n.documentation || '',
      properties: el?.properties || n.properties || {},
      rawElement: el || undefined,
      specifiedParentId: n.parent_id || null,
      inferredParentId: null,
      finalParentId: null,
      width,
      height,
      x: Number(n.x) || 0,
      y: Number(n.y) || 0
    });

    if (elId) {
      elementIdToNodeId.set(elId, nodeId);
    }
  });

  // 2. Identify Nested Containers via Relations (Composition, Aggregation, Assignment)
  // or pre-existing explicit parent_id in XML/view_data
  const containerRelationships = new Set([
    'compositionrelationship',
    'aggregationrelationship',
    'assignmentrelationship'
  ]);

  const nestingEdgeIds = new Set<string>();

  rawConns.forEach((c) => {
    const rel = c.relationship_id ? relationshipLookup.get(c.relationship_id) : null;
    const relType = (rel?.type || c.type || '').toLowerCase().replace(/archimate:/g, '').trim();

    // Source contains target (e.g., Application Component contains Component or Function)
    if (containerRelationships.has(relType)) {
      const srcNodeId = c.source_node_id || c.source || elementIdToNodeId.get(c.source_id);
      const tgtNodeId = c.target_node_id || c.target || elementIdToNodeId.get(c.target_id);

      if (srcNodeId && tgtNodeId && srcNodeId !== tgtNodeId) {
        const targetNode = nodeMap.get(tgtNodeId);
        const sourceNode = nodeMap.get(srcNodeId);

        // Check for cycles before nesting
        if (targetNode && sourceNode && !targetNode.specifiedParentId) {
          targetNode.inferredParentId = srcNodeId;
          if (c.id) nestingEdgeIds.add(c.id);
        }
      }
    }
  });

  // Assign finalParentId (prefer explicit, then inferred if enabled in nested mode)
  const isNestingAllowed = options.mode === 'nested';

  nodeMap.forEach((node) => {
    if (node.specifiedParentId && nodeMap.has(node.specifiedParentId)) {
      node.finalParentId = node.specifiedParentId;
    } else if (isNestingAllowed && node.inferredParentId && nodeMap.has(node.inferredParentId)) {
      // Prevent nesting loops
      let curr = node.inferredParentId;
      let loop = false;
      while (curr) {
        if (curr === node.id) {
          loop = true;
          break;
        }
        curr = nodeMap.get(curr)?.inferredParentId || null;
      }
      if (!loop) {
        node.finalParentId = node.inferredParentId;
      }
    }
  });

  // 3. Layout computation based on chosen mode
  const HORIZ_GAP = options.horizontalSpacing || 30;
  const VERT_GAP = options.verticalSpacing || 40;
  const CONTAINER_PADDING = options.containerPadding || 25;

  // Find parents and their children
  const childrenMap = new Map<string, string[]>();
  nodeMap.forEach((node) => {
    if (node.finalParentId) {
      const list = childrenMap.get(node.finalParentId) || [];
      list.push(node.id);
      childrenMap.set(node.finalParentId, list);
    }
  });

  // Recursive dimension calculation for containers
  function calculateDimensions(nodeId: string): { width: number; height: number } {
    const node = nodeMap.get(nodeId)!;
    const childrenIds = childrenMap.get(nodeId);

    if (!childrenIds || childrenIds.length === 0) {
      return { width: node.width, height: node.height };
    }

    // Node is a container: size it to comfortably fit all children
    const cols = Math.min(3, Math.ceil(Math.sqrt(childrenIds.length)));
    let maxChildW = 0;
    let maxChildH = 0;

    childrenIds.forEach((childId) => {
      const dims = calculateDimensions(childId);
      maxChildW = Math.max(maxChildW, dims.width);
      maxChildH = Math.max(maxChildH, dims.height);
    });

    const rows = Math.ceil(childrenIds.length / cols);
    const calculatedW = CONTAINER_PADDING * 2 + cols * maxChildW + (cols - 1) * HORIZ_GAP;
    const calculatedH = CONTAINER_PADDING * 2 + 35 + rows * maxChildH + (rows - 1) * VERT_GAP; // 35px header

    node.width = Math.max(node.width, calculatedW, 260);
    node.height = Math.max(node.height, calculatedH, 140);

    return { width: node.width, height: node.height };
  }

  // Calculate dimensions starting from root containers
  nodeMap.forEach((node) => {
    if (!node.finalParentId) {
      calculateDimensions(node.id);
    }
  });

  // Layout children inside their containers relative to (0,0)
  function layoutChildren(parentId: string) {
    const childrenIds = childrenMap.get(parentId);
    if (!childrenIds || childrenIds.length === 0) return;

    const cols = Math.min(3, Math.ceil(Math.sqrt(childrenIds.length)));
    childrenIds.forEach((childId, idx) => {
      const child = nodeMap.get(childId)!;
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      child.x = CONTAINER_PADDING + col * (child.width + HORIZ_GAP);
      child.y = CONTAINER_PADDING + 35 + row * (child.height + VERT_GAP);

      layoutChildren(childId);
    });
  }

  nodeMap.forEach((node) => {
    if (childrenMap.has(node.id)) {
      layoutChildren(node.id);
    }
  });

  // If layered mode or compact mode, arrange top-level nodes by ArchiMate Layer
  if (options.mode === 'layered' || options.mode === 'compact') {
    // Group top-level nodes by ArchiMate layer
    const layerGroups = new Map<string, NodeMeta[]>();

    nodeMap.forEach((node) => {
      if (!node.finalParentId) {
        const lyr = node.layer || 'application';
        const list = layerGroups.get(lyr) || [];
        list.push(node);
        layerGroups.set(lyr, list);
      }
    });

    // Sort layers according to standard ArchiMate hierarchy (Top to Bottom):
    // Strategy -> Business -> Application -> Technology -> Motivation -> Implementation -> Other
    const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => {
      const orderA = ARCHIMATE_LAYER_ORDER[a] ?? 99;
      const orderB = ARCHIMATE_LAYER_ORDER[b] ?? 99;
      return orderA - orderB;
    });

    let currentY = 50;
    const startX = 60;

    sortedLayers.forEach((layerKey) => {
      const nodesInLayer = layerGroups.get(layerKey)!;
      let currentX = startX;
      let maxRowHeight = 0;
      const MAX_ROW_WIDTH = 1200;

      nodesInLayer.forEach((node) => {
        if (currentX > startX && currentX + node.width > startX + MAX_ROW_WIDTH) {
          // Wrap to next row within same layer
          currentX = startX;
          currentY += maxRowHeight + VERT_GAP;
          maxRowHeight = 0;
        }

        node.x = currentX;
        node.y = currentY;

        currentX += node.width + HORIZ_GAP;
        maxRowHeight = Math.max(maxRowHeight, node.height);
      });

      // Move to next layer band with clear separation
      currentY += maxRowHeight + (VERT_GAP * 1.5);
    });
  } else if (options.mode === 'original') {
    // Preserve stored coordinates, but resolve collision if overlapping
    const topNodes = Array.from(nodeMap.values()).filter((n) => !n.finalParentId);
    // Simple collision push
    for (let i = 0; i < topNodes.length; i++) {
      for (let j = i + 1; j < topNodes.length; j++) {
        const a = topNodes[i];
        const b = topNodes[j];
        if (
          Math.abs(a.x - b.x) < 50 &&
          Math.abs(a.y - b.y) < 40
        ) {
          b.x += 160;
          b.y += 80;
        }
      }
    }
  }

  // 4. Build output ReactFlow nodes with parentId and ordering
  const outputNodes: ProcessedNode[] = [];

  // Topologically sort so parents are added before children
  const visited = new Set<string>();

  function emitNode(nodeId: string) {
    if (visited.has(nodeId)) return;
    const node = nodeMap.get(nodeId)!;

    if (node.finalParentId && !visited.has(node.finalParentId)) {
      emitNode(node.finalParentId);
    }

    visited.add(nodeId);
    const isContainer = (childrenMap.get(nodeId)?.length || 0) > 0;

    outputNodes.push({
      id: node.id,
      type: 'archimateNode',
      position: { x: Math.round(node.x), y: Math.round(node.y) },
      parentId: node.finalParentId || undefined,
      style: isContainer
        ? {
            width: node.width,
            height: node.height,
            zIndex: 0
          }
        : {
            width: node.width,
            height: node.height,
            zIndex: 1
          },
      data: {
        label: node.label,
        type: node.type,
        layer: node.layer,
        documentation: node.documentation,
        properties: node.properties,
        rawElement: node.rawElement,
        isContainer,
        childrenCount: childrenMap.get(nodeId)?.length || 0
      }
    });
  }

  nodeMap.forEach((_, id) => emitNode(id));

  // 5. Build output ReactFlow edges
  const outputEdges: ProcessedEdge[] = [];
  const edgeDeduplication = new Set<string>();

  rawConns.forEach((c, idx) => {
    // If connection was used for visual nesting, optionally don't draw duplicate edge
    if (nestingEdgeIds.has(c.id) && options.mode === 'nested') {
      return;
    }

    const srcId = c.source_node_id || c.source || elementIdToNodeId.get(c.source_id);
    const tgtId = c.target_node_id || c.target || elementIdToNodeId.get(c.target_id);

    if (!srcId || !tgtId || srcId === tgtId) return;

    const dedupKey = `${srcId}->${tgtId}:${c.relationship_id || c.type || ''}`;
    if (edgeDeduplication.has(dedupKey)) return;
    edgeDeduplication.add(dedupKey);

    const rel = c.relationship_id ? relationshipLookup.get(c.relationship_id) : null;
    const relType = rel?.type || c.type || c.name || '';
    const label = c.name || rel?.name || '';

    outputEdges.push({
      id: c.id || `edge-${idx}`,
      source: srcId,
      target: tgtId,
      type: 'smoothstep',
      relType,
      data: { relType, relationshipId: c.relationship_id },
      label
    });
  });

  return { nodes: outputNodes, edges: outputEdges };
}
