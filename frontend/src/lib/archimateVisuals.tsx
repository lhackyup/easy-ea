import React from 'react';
import { Handle, Position, MarkerType } from '@xyflow/react';

export interface LayerStyle {
  bg: string;
  border: string;
  text: string;
  shadow: string;
  accent: string;
  headerBg?: string;
}

export const ARCHIMATE_LAYER_THEMES: Record<string, LayerStyle> = {
  strategy: {
    bg: '#FBF0D9',
    border: '#C89234',
    text: '#452603',
    shadow: 'rgba(200, 146, 52, 0.15)',
    accent: '#B07A20'
  },
  business: {
    bg: '#FFFFC8',
    border: '#C6B726',
    text: '#3B3302',
    shadow: 'rgba(198, 183, 38, 0.15)',
    accent: '#A89914'
  },
  application: {
    bg: '#C2FFFF',
    border: '#3DA3C0',
    text: '#03333D',
    shadow: 'rgba(61, 163, 192, 0.15)',
    accent: '#26809A'
  },
  technology: {
    bg: '#D4F0C2',
    border: '#6EA84B',
    text: '#173607',
    shadow: 'rgba(110, 168, 75, 0.15)',
    accent: '#528733'
  },
  physical: {
    bg: '#D4F0C2',
    border: '#6EA84B',
    text: '#173607',
    shadow: 'rgba(110, 168, 75, 0.15)',
    accent: '#528733'
  },
  motivation: {
    bg: '#DCDCFE',
    border: '#7878CC',
    text: '#17174A',
    shadow: 'rgba(120, 120, 204, 0.15)',
    accent: '#5A5AA6'
  },
  implementation: {
    bg: '#FFEAE8',
    border: '#CB7C7C',
    text: '#451616',
    shadow: 'rgba(203, 124, 124, 0.15)',
    accent: '#A85757'
  },
  other: {
    bg: '#F1F5F9',
    border: '#94A3B8',
    text: '#1E293B',
    shadow: 'rgba(148, 163, 184, 0.15)',
    accent: '#64748B'
  }
};

export function getLayerTheme(layer?: string): LayerStyle {
  const l = (layer || 'application').toLowerCase().trim();
  return ARCHIMATE_LAYER_THEMES[l] || ARCHIMATE_LAYER_THEMES.other;
}

/**
 * Returns the classic Archi / ArchiMate 3.x miniature corner icon for a concept.
 */
export const ArchiConceptIcon: React.FC<{ type?: string; color?: string; className?: string }> = ({
  type = '',
  color = '#475569',
  className = 'w-4 h-4'
}) => {
  const norm = type.toLowerCase().replace(/relationship|element|archimate:/g, '').trim();

  // Application Component - Iconic UML 2-tab box
  if (norm.includes('component')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <rect x="5" y="4" width="16" height="16" rx="1.5" />
        <rect x="2" y="7" width="6" height="3" rx="0.5" fill={color} />
        <rect x="2" y="14" width="6" height="3" rx="0.5" fill={color} />
      </svg>
    );
  }

  // Interface / API - Lollipop / Socket circle
  if (norm.includes('interface') || norm.includes('api')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <circle cx="10" cy="12" r="5" />
        <path d="M15 12h6" strokeLinecap="round" />
      </svg>
    );
  }

  // Services - Capsule / Pill
  if (norm.includes('service')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <rect x="3" y="7" width="18" height="10" rx="5" />
        <line x1="8" y1="7" x2="8" y2="17" />
      </svg>
    );
  }

  // Process / Workflow - Chevron »
  if (norm.includes('process') || norm.includes('stream')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="2">
        <path d="M4 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Function - Chevron in box
  if (norm.includes('function')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <path d="M8 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Business Actor / Stakeholder - Stick figure
  if (norm.includes('actor') || norm.includes('stakeholder')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <circle cx="12" cy="7" r="3.5" />
        <path d="M6 21v-3.5a4.5 4.5 0 0 1 4.5-4.5h3a4.5 4.5 0 0 1 4.5 4.5V21" />
        <path d="M6 14l-2 3M18 14l2 3" />
      </svg>
    );
  }

  // Role - Actor with bar
  if (norm.includes('role')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="12" cy="10" r="2.5" />
        <path d="M8 17a4 4 0 0 1 8 0" />
      </svg>
    );
  }

  // Data Object / Business Object / Document / Artifact
  if (norm.includes('object') || norm.includes('artifact') || norm.includes('deliverable') || norm.includes('representation')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <polyline points="14 3 14 8 19 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    );
  }

  // Node / Device - Isometric 3D Cube
  if (norm.includes('node') || norm.includes('device') || norm.includes('facility') || norm.includes('equipment')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
        <path d="M12 2v9M12 11l8-4.5M12 11L4 6.5" />
      </svg>
    );
  }

  // System Software / Database - Cylinder
  if (norm.includes('software') || norm.includes('database') || norm.includes('storage') || norm.includes('system')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
        <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
      </svg>
    );
  }

  // Network / Communication - Cloud
  if (norm.includes('network') || norm.includes('path') || norm.includes('cloud')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <path d="M6.5 19a4.5 4.5 0 0 1-.8-8.93 6 6 0 0 1 11.66-1.57A4.5 4.5 0 0 1 17.5 19h-11z" />
      </svg>
    );
  }

  // Goal / Requirement / Constraint / Principle - Target / Bullseye
  if (norm.includes('goal') || norm.includes('requirement') || norm.includes('constraint') || norm.includes('principle') || norm.includes('driver')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill={color} />
      </svg>
    );
  }

  // WorkPackage / Project
  if (norm.includes('work') || norm.includes('package') || norm.includes('plateau') || norm.includes('gap')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
        <rect x="3" y="7" width="18" height="13" rx="1.5" />
        <path d="M8 7V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3" />
      </svg>
    );
  }

  // Default Element Box
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={color} strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
};

/**
 * Authentic ArchiMate Node View matching Archi's clean layout & colors.
 */
export const ArchimateStandardNode = ({ data }: any) => {
  const theme = getLayerTheme(data.layer);
  const isSelected = data.isSelected;
  const isContainer = Boolean(data.isContainer);
  const isDimmed = Boolean(data.isDimmed);

  return (
    <div
      style={{
        backgroundColor: isContainer ? `${theme.bg}CC` : theme.bg,
        borderColor: isSelected ? '#2563EB' : theme.border,
        boxShadow: isSelected
          ? '0 0 0 2.5px rgba(37, 99, 235, 0.45), 0 4px 12px ' + theme.shadow
          : '0 2px 6px ' + theme.shadow,
        color: theme.text,
        width: isContainer ? '100%' : undefined,
        height: isContainer ? '100%' : undefined,
        opacity: isDimmed ? 0.25 : 1
      }}
      className={`relative rounded-lg border-[1.5px] transition-all duration-150 cursor-pointer group box-border overflow-hidden ${
        isContainer
          ? 'p-2.5 border-dashed flex flex-col justify-start'
          : 'px-3 py-2 min-w-[170px] max-w-[280px] hover:brightness-[0.98]'
      }`}
    >
      {/* 4 Handles for Multi-directional ArchiMate Edge Routing */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-slate-500 !border !border-white !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-500 !border !border-white !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-slate-500 !border !border-white !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-slate-500 !border !border-white !opacity-0 group-hover:!opacity-100 transition-opacity"
      />

      {/* Top Header: Concept Subtype & Top-Right Archi Icon */}
      <div
        className={`flex items-center justify-between gap-1.5 w-full min-w-0 ${
          isContainer ? 'border-b border-black/10 pb-1.5 mb-1' : 'mb-0.5'
        }`}
      >
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
          <span
            style={{ color: theme.accent }}
            title={data.type || 'Element'}
            className="text-[8px] font-extrabold uppercase tracking-tight truncate opacity-90 select-none block"
          >
            {data.type || 'Element'}
          </span>
          {isContainer && (
            <span className="text-xs font-bold leading-tight tracking-tight select-none mt-0.5 truncate block">
              {data.label || 'Contenitore'}
            </span>
          )}
        </div>
        <div className="shrink-0 opacity-85 group-hover:opacity-100 transition-opacity ml-1 flex items-center justify-center">
          <ArchiConceptIcon type={data.type} color={theme.accent} className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Center: Element Name / Label (for standard non-container nodes) */}
      {!isContainer && (
        <div className="text-xs font-bold leading-snug tracking-tight text-center break-words select-none py-0.5 px-0.5">
          {data.label || 'Senza Nome'}
        </div>
      )}

      {/* Optional Documentation Snippet */}
      {!isContainer && data.documentation && (
        <div className="text-[9.5px] opacity-75 line-clamp-1 mt-1 font-normal border-t border-black/5 pt-0.5 text-center px-0.5">
          {data.documentation}
        </div>
      )}
    </div>
  );
};

/**
 * Returns authentic SVG marker & style properties for standard ArchiMate relationships.
 */
export function getArchimateEdgeProps(relType: string, label?: string) {
  const norm = (relType || '').toLowerCase().replace(/relationship|archimate:/g, '').trim();

  // Composition: Solid line + Filled Diamond at start
  if (norm.includes('composition')) {
    return {
      style: { stroke: '#1E293B', strokeWidth: 1.75 },
      markerStart: 'url(#archimate-marker-composition)',
      markerEnd: undefined,
      label: label || '',
      animated: false
    };
  }

  // Aggregation: Solid line + Hollow Diamond at start
  if (norm.includes('aggregation')) {
    return {
      style: { stroke: '#334155', strokeWidth: 1.75 },
      markerStart: 'url(#archimate-marker-aggregation)',
      markerEnd: undefined,
      label: label || '',
      animated: false
    };
  }

  // Realization: Dashed line + Hollow Triangle at end
  if (norm.includes('realization')) {
    return {
      style: { stroke: '#0284C7', strokeWidth: 1.75, strokeDasharray: '5,4' },
      markerEnd: 'url(#archimate-marker-realization)',
      label: label || '',
      animated: false
    };
  }

  // Assignment: Solid line + Filled Circles / arrow
  if (norm.includes('assignment')) {
    return {
      style: { stroke: '#059669', strokeWidth: 1.75 },
      markerStart: 'url(#archimate-marker-assignment)',
      markerEnd: 'url(#archimate-marker-arrow-open)',
      label: label || '',
      animated: false
    };
  }

  // Serving / UsedBy: Solid line + Open Arrow at end
  if (norm.includes('serving') || norm.includes('used')) {
    return {
      style: { stroke: '#475569', strokeWidth: 1.75 },
      markerEnd: 'url(#archimate-marker-arrow-open)',
      label: label || '',
      animated: false
    };
  }

  // Access: Dashed line + Open Arrow at end
  if (norm.includes('access')) {
    return {
      style: { stroke: '#D97706', strokeWidth: 1.75, strokeDasharray: '4,4' },
      markerEnd: 'url(#archimate-marker-arrow-open)',
      label: label || '',
      animated: false
    };
  }

  // Triggering: Solid line + Filled Arrow at end
  if (norm.includes('triggering')) {
    return {
      style: { stroke: '#DC2626', strokeWidth: 1.75 },
      markerEnd: 'url(#archimate-marker-arrow-closed)',
      label: label || '',
      animated: false
    };
  }

  // Flow: Dashed line + Filled Arrow at end
  if (norm.includes('flow')) {
    return {
      style: { stroke: '#7C3AED', strokeWidth: 1.75, strokeDasharray: '5,4' },
      markerEnd: 'url(#archimate-marker-arrow-closed)',
      label: label || '',
      animated: true
    };
  }

  // Specialization: Solid line + Hollow Triangle at end
  if (norm.includes('specialization')) {
    return {
      style: { stroke: '#0F766E', strokeWidth: 1.75 },
      markerEnd: 'url(#archimate-marker-specialization)',
      label: label || '',
      animated: false
    };
  }

  // Association: Solid plain line
  return {
    style: { stroke: '#64748B', strokeWidth: 1.5 },
    markerEnd: undefined,
    label: label || '',
    animated: false
  };
}

/**
 * Custom SVG Marker definitions for ReactFlow canvas rendering authentic ArchiMate arrows.
 */
export const ArchimateSvgDefs: React.FC = () => {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      <defs>
        {/* Composition: Filled Diamond */}
        <marker
          id="archimate-marker-composition"
          viewBox="0 0 16 16"
          refX="4"
          refY="8"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <polygon points="8,2 14,8 8,14 2,8" fill="#1E293B" stroke="#1E293B" strokeWidth="1" />
        </marker>

        {/* Aggregation: Hollow Diamond */}
        <marker
          id="archimate-marker-aggregation"
          viewBox="0 0 16 16"
          refX="4"
          refY="8"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <polygon points="8,2 14,8 8,14 2,8" fill="#FFFFFF" stroke="#334155" strokeWidth="1.5" />
        </marker>

        {/* Assignment: Filled Circle */}
        <marker
          id="archimate-marker-assignment"
          viewBox="0 0 16 16"
          refX="8"
          refY="8"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <circle cx="8" cy="8" r="4.5" fill="#059669" stroke="#059669" />
        </marker>

        {/* Realization / Specialization: Hollow Triangle */}
        <marker
          id="archimate-marker-realization"
          viewBox="0 0 16 16"
          refX="13"
          refY="8"
          markerWidth="11"
          markerHeight="11"
          orient="auto"
        >
          <polygon points="3,2 14,8 3,14" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
        </marker>

        <marker
          id="archimate-marker-specialization"
          viewBox="0 0 16 16"
          refX="13"
          refY="8"
          markerWidth="11"
          markerHeight="11"
          orient="auto"
        >
          <polygon points="3,2 14,8 3,14" fill="#FFFFFF" stroke="#0F766E" strokeWidth="1.5" />
        </marker>

        {/* Serving / Access: Open Arrow */}
        <marker
          id="archimate-marker-arrow-open"
          viewBox="0 0 16 16"
          refX="12"
          refY="8"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <polyline points="4,3 13,8 4,13" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        </marker>

        {/* Triggering / Flow: Closed Filled Arrow */}
        <marker
          id="archimate-marker-arrow-closed"
          viewBox="0 0 16 16"
          refX="12"
          refY="8"
          markerWidth="10"
          markerHeight="10"
          orient="auto"
        >
          <polygon points="3,3 14,8 3,13" fill="#1E293B" stroke="#1E293B" />
        </marker>
      </defs>
    </svg>
  );
};
