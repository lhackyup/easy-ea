/**
 * ArchiMate 3.x Shape Palette and Stencils for Draw.io (diagrams.net).
 * Defines XML stencils, layer colors, and standard shape representations.
 */

export interface ArchimateShapeDef {
  type: string;
  layer: 'Strategy' | 'Business' | 'Application' | 'Technology' | 'Physical' | 'Motivation' | 'Implementation';
  label: string;
  fillColor: string;
  strokeColor: string;
  shapeStyle: string;
  width: number;
  height: number;
  iconHint?: string;
}

export const ARCHIMATE_LAYER_COLORS = {
  Strategy: { fill: '#F5DEAA', stroke: '#C89234', text: '#5C3806' },
  Business: { fill: '#FFFFB5', stroke: '#C4B827', text: '#4B4204' },
  Application: { fill: '#B5FFFF', stroke: '#40A9C4', text: '#053B47' },
  Technology: { fill: '#C9E7B7', stroke: '#6EA84B', text: '#1E430B' },
  Physical: { fill: '#C9E7B7', stroke: '#6EA84B', text: '#1E430B' },
  Motivation: { fill: '#CCCCFF', stroke: '#7575C7', text: '#1E1E5E' },
  Implementation: { fill: '#FFE0E0', stroke: '#C77A7A', text: '#531B1B' }
};

export const ARCHIMATE_SHAPES: ArchimateShapeDef[] = [
  // Strategy Layer
  {
    type: 'Resource',
    layer: 'Strategy',
    label: 'Resource',
    fillColor: ARCHIMATE_LAYER_COLORS.Strategy.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Strategy.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'Capability',
    layer: 'Strategy',
    label: 'Capability',
    fillColor: ARCHIMATE_LAYER_COLORS.Strategy.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Strategy.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'ValueStream',
    layer: 'Strategy',
    label: 'Value Stream',
    fillColor: ARCHIMATE_LAYER_COLORS.Strategy.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Strategy.stroke,
    shapeStyle: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
    width: 170,
    height: 65
  },
  {
    type: 'CourseOfAction',
    layer: 'Strategy',
    label: 'Course of Action',
    fillColor: ARCHIMATE_LAYER_COLORS.Strategy.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Strategy.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },

  // Business Layer
  {
    type: 'BusinessActor',
    layer: 'Business',
    label: 'Business Actor',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;',
    width: 40,
    height: 70
  },
  {
    type: 'BusinessRole',
    layer: 'Business',
    label: 'Business Role',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'BusinessProcess',
    layer: 'Business',
    label: 'Business Process',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
    width: 170,
    height: 65
  },
  {
    type: 'BusinessFunction',
    layer: 'Business',
    label: 'Business Function',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'BusinessService',
    layer: 'Business',
    label: 'Business Service',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
    width: 160,
    height: 65
  },
  {
    type: 'BusinessEvent',
    layer: 'Business',
    label: 'Business Event',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
    width: 160,
    height: 60
  },
  {
    type: 'BusinessObject',
    layer: 'Business',
    label: 'Business Object',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'rounded=0;whiteSpace=wrap;html=1;',
    width: 150,
    height: 65
  },
  {
    type: 'Representation',
    layer: 'Business',
    label: 'Representation',
    fillColor: ARCHIMATE_LAYER_COLORS.Business.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Business.stroke,
    shapeStyle: 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
    width: 150,
    height: 65
  },

  // Application Layer
  {
    type: 'ApplicationComponent',
    layer: 'Application',
    label: 'Application Component',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 170,
    height: 70
  },
  {
    type: 'ApplicationInterface',
    layer: 'Application',
    label: 'Application Interface',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'ellipse;whiteSpace=wrap;html=1;',
    width: 60,
    height: 60
  },
  {
    type: 'ApplicationService',
    layer: 'Application',
    label: 'Application Service',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
    width: 170,
    height: 65
  },
  {
    type: 'ApplicationFunction',
    layer: 'Application',
    label: 'Application Function',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'ApplicationProcess',
    layer: 'Application',
    label: 'Application Process',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
    width: 170,
    height: 65
  },
  {
    type: 'DataObject',
    layer: 'Application',
    label: 'Data Object',
    fillColor: ARCHIMATE_LAYER_COLORS.Application.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Application.stroke,
    shapeStyle: 'rounded=0;whiteSpace=wrap;html=1;',
    width: 150,
    height: 65
  },

  // Technology Layer
  {
    type: 'Node',
    layer: 'Technology',
    label: 'Infrastructure Node',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;',
    width: 170,
    height: 75
  },
  {
    type: 'Device',
    layer: 'Technology',
    label: 'Device / Server',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;',
    width: 170,
    height: 75
  },
  {
    type: 'SystemSoftware',
    layer: 'Technology',
    label: 'System Software / DB',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;',
    width: 150,
    height: 70
  },
  {
    type: 'TechnologyService',
    layer: 'Technology',
    label: 'Technology Service',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
    width: 170,
    height: 65
  },
  {
    type: 'CommunicationNetwork',
    layer: 'Technology',
    label: 'Communication Network',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;',
    width: 170,
    height: 80
  },
  {
    type: 'Artifact',
    layer: 'Technology',
    label: 'Artifact / Package',
    fillColor: ARCHIMATE_LAYER_COLORS.Technology.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Technology.stroke,
    shapeStyle: 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
    width: 150,
    height: 65
  },

  // Motivation Layer
  {
    type: 'Stakeholder',
    layer: 'Motivation',
    label: 'Stakeholder',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;',
    width: 40,
    height: 70
  },
  {
    type: 'Driver',
    layer: 'Motivation',
    label: 'Driver',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'Goal',
    layer: 'Motivation',
    label: 'Goal',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
    width: 160,
    height: 65
  },
  {
    type: 'Principle',
    layer: 'Motivation',
    label: 'Principle',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'Requirement',
    layer: 'Motivation',
    label: 'Requirement',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
    width: 160,
    height: 65
  },
  {
    type: 'Constraint',
    layer: 'Motivation',
    label: 'Constraint',
    fillColor: ARCHIMATE_LAYER_COLORS.Motivation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Motivation.stroke,
    shapeStyle: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
    width: 160,
    height: 65
  },

  // Implementation Layer
  {
    type: 'WorkPackage',
    layer: 'Implementation',
    label: 'Work Package',
    fillColor: ARCHIMATE_LAYER_COLORS.Implementation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Implementation.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  },
  {
    type: 'Deliverable',
    layer: 'Implementation',
    label: 'Deliverable',
    fillColor: ARCHIMATE_LAYER_COLORS.Implementation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Implementation.stroke,
    shapeStyle: 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
    width: 150,
    height: 65
  },
  {
    type: 'Plateau',
    layer: 'Implementation',
    label: 'Plateau (Target State)',
    fillColor: ARCHIMATE_LAYER_COLORS.Implementation.fill,
    strokeColor: ARCHIMATE_LAYER_COLORS.Implementation.stroke,
    shapeStyle: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    width: 160,
    height: 65
  }
];

export const ARCHIMATE_RELATIONSHIPS = [
  {
    type: 'ServingRelationship',
    label: 'Serving',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;endFill=0;strokeColor=#4F46E5;strokeWidth=2;'
  },
  {
    type: 'RealizationRelationship',
    label: 'Realization',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=block;endFill=0;strokeColor=#0284C7;strokeWidth=2;'
  },
  {
    type: 'AssignmentRelationship',
    label: 'Assignment',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=oval;endFill=1;startArrow=oval;startFill=1;strokeColor=#059669;strokeWidth=2;'
  },
  {
    type: 'CompositionRelationship',
    label: 'Composition',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=1;endArrow=none;strokeColor=#1E293B;strokeWidth=2;'
  },
  {
    type: 'AggregationRelationship',
    label: 'Aggregation',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=0;endArrow=none;strokeColor=#475569;strokeWidth=2;'
  },
  {
    type: 'AccessRelationship',
    label: 'Access',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=open;endFill=0;strokeColor=#D97706;strokeWidth=2;'
  },
  {
    type: 'TriggeringRelationship',
    label: 'Triggering',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=classic;endFill=1;strokeColor=#DC2626;strokeWidth=2;'
  },
  {
    type: 'FlowRelationship',
    label: 'Flow',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=classic;endFill=1;strokeColor=#7C3AED;strokeWidth=2;'
  },
  {
    type: 'SpecializationRelationship',
    label: 'Specialization',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=0;strokeColor=#0F766E;strokeWidth=2;'
  },
  {
    type: 'AssociationRelationship',
    label: 'Association',
    style: 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;strokeColor=#64748B;strokeWidth=2;'
  }
];

export const MODERN_STENCIL_PRESETS: Record<
  string,
  { label: string; style: string; width: number; height: number; description?: string }
> = {
  modern_card: {
    label: 'Modern Card (Default)',
    style: 'rounded=1;arcSize=14;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;',
    width: 170,
    height: 70,
    description: 'Card moderna pulita con angoli arrotondati e ombra sottile'
  },
  modern_microservice: {
    label: 'Modern Microservice',
    style: 'shape=ext;double=1;rounded=1;arcSize=14;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;',
    width: 175,
    height: 75,
    description: 'Componente/servizio con bordo doppio e badge visivo'
  },
  modern_database: {
    label: 'Modern Database / Storage',
    style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=14;shadow=1;strokeWidth=1.5;rounded=1;arcSize=8;',
    width: 150,
    height: 75,
    description: 'Cilindro dati moderno con ombra ed angoli smussati'
  },
  modern_cloud_node: {
    label: 'Modern Cloud Node',
    style: 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.04;darkOpacity2=0.08;shadow=1;rounded=1;arcSize=10;strokeWidth=1.5;',
    width: 170,
    height: 80,
    description: 'Nodo infrastruttura o container cloud moderno'
  },
  modern_api_interface: {
    label: 'Modern API / Gateway',
    style: 'shape=ext;rounded=1;arcSize=30;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;',
    width: 160,
    height: 55,
    description: 'Pill / Endpoint API moderno smussato'
  },
  modern_hex: {
    label: 'Modern Hexagon (Domain/DDD)',
    style: 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=16;rounded=1;arcSize=10;shadow=1;strokeWidth=1.5;whiteSpace=wrap;html=1;',
    width: 160,
    height: 80,
    description: 'Esagono per domini DDD, bounded context e core service'
  },
  modern_process: {
    label: 'Modern Process / Step',
    style: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;rounded=1;arcSize=12;shadow=1;strokeWidth=1.5;',
    width: 170,
    height: 65,
    description: 'Step di processo o workflow con raccordo moderno'
  },
  modern_event_stream: {
    label: 'Modern Event Stream / Topic',
    style: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;rounded=1;arcSize=20;shadow=1;strokeWidth=1.5;',
    width: 160,
    height: 60,
    description: 'Coda o stream di messaggi (Kafka / Event bus)'
  },
  modern_actor: {
    label: 'Modern Actor / Role',
    style: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;shadow=1;strokeWidth=1.5;',
    width: 45,
    height: 75,
    description: 'Attore o ruolo con contorno ombreggiato'
  }
};

export const STENCIL_ICON_GLYPHS: Record<string, string> = {
  server: '🖥️',
  database: '🗄️',
  cloud: '☁️',
  api: '⚡',
  shield: '🛡️',
  cog: '⚙️',
  cpu: '💾',
  layers: '📦',
  network: '🌐',
  user: '👤'
};

/**
 * Builds custom Draw.io JSON library config for injection into the embed iframe.
 */
export function buildDrawioArchimateLibrary(): any[] {
  return ARCHIMATE_SHAPES.map((shape) => {
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="${shape.label}" archimate_type="${shape.type}" layer="${shape.layer}" id="elem"><mxCell style="${shape.shapeStyle}fillColor=${shape.fillColor};strokeColor=${shape.strokeColor};fontColor=${ARCHIMATE_LAYER_COLORS[shape.layer].text};fontStyle=1;" vertex="1" parent="1"><mxGeometry width="${shape.width}" height="${shape.height}" as="geometry"/></mxCell></object></root></mxGraphModel>`;
    return {
      xml,
      w: shape.width,
      h: shape.height,
      title: `${shape.label} (${shape.layer})`
    };
  });
}

export interface LayerLibraryDef {
  id: string;
  layer: string;
  title: string;
  shortTitle: string;
  entries: any[];
}

/**
 * Builds separate Draw.io libraries for each ArchiMate layer.
 * Allows architects to find shapes easily per layer without one giant uncategorized list.
 */
export function buildDrawioArchimateLayerLibraries(): LayerLibraryDef[] {
  const layerDefs = [
    { layer: 'Strategy', id: 'easyea_archimate_strategy', label: 'Strategy', icon: '🎯' },
    { layer: 'Business', id: 'easyea_archimate_business', label: 'Business', icon: '💼' },
    { layer: 'Application', id: 'easyea_archimate_application', label: 'Application', icon: '💻' },
    { layer: 'Technology', id: 'easyea_archimate_technology', label: 'Technology & Physical', icon: '🖥️' },
    { layer: 'Motivation', id: 'easyea_archimate_motivation', label: 'Motivation', icon: '💡' },
    { layer: 'Implementation', id: 'easyea_archimate_implementation', label: 'Implementation & Migration', icon: '🚀' }
  ];

  return layerDefs.map(({ layer, id, label, icon }) => {
    const shapes = ARCHIMATE_SHAPES.filter((shape) => {
      if (layer === 'Technology') {
        return shape.layer === 'Technology' || shape.layer === 'Physical';
      }
      return shape.layer === layer;
    });

    const entries = shapes.map((shape) => {
      const colors = ARCHIMATE_LAYER_COLORS[shape.layer] || ARCHIMATE_LAYER_COLORS.Application;
      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="${shape.label}" archimate_type="${shape.type}" layer="${shape.layer}" id="elem"><mxCell style="${shape.shapeStyle}fillColor=${shape.fillColor};strokeColor=${shape.strokeColor};fontColor=${colors.text};fontStyle=1;" vertex="1" parent="1"><mxGeometry width="${shape.width}" height="${shape.height}" as="geometry"/></mxCell></object></root></mxGraphModel>`;
      return {
        xml,
        w: shape.width,
        h: shape.height,
        title: shape.label
      };
    });

    return {
      id,
      layer,
      title: `${icon} EasyEA ArchiMate - ${label}`,
      shortTitle: `${icon} ${label}`,
      entries
    };
  });
}

/**
 * Helper to determine ArchiMate layer from element type
 */
export function getElementLayer(type: string): keyof typeof ARCHIMATE_LAYER_COLORS {
  const found = ARCHIMATE_SHAPES.find((s) => s.type === type);
  if (found) return found.layer as keyof typeof ARCHIMATE_LAYER_COLORS;
  if (type.startsWith('Business')) return 'Business';
  if (type.startsWith('Application')) return 'Application';
  if (type.startsWith('Technology') || type === 'Node' || type === 'Device' || type === 'SystemSoftware' || type === 'Artifact' || type === 'Path' || type === 'CommunicationNetwork') return 'Technology';
  if (type.startsWith('Strategy') || type === 'Resource' || type === 'Capability' || type === 'CourseOfAction' || type === 'ValueStream') return 'Strategy';
  if (type.startsWith('Motivation') || type === 'Stakeholder' || type === 'Driver' || type === 'Assessment' || type === 'Goal' || type === 'Outcome' || type === 'Principle' || type === 'Requirement' || type === 'Constraint' || type === 'Meaning' || type === 'Value') return 'Motivation';
  if (type.startsWith('Implementation') || type === 'WorkPackage' || type === 'Deliverable' || type === 'Plateau' || type === 'Gap') return 'Implementation';
  return 'Application';
}

/**
 * Builds Modern Look & Feel stencil library for Draw.io (Optionally activated).
 * Highlights specific enterprise architecture stereotypes with distinctive modern shapes,
 * icons, and ArchiMate layer coloring, while retaining clean cards for general modeling.
 */
export function buildDrawioModernLibrary(stereotypes?: any[]): any[] {
  const libraryEntries: any[] = [];
  const processedStereoKeys = new Set<string>();

  // 1. Process Stereotypes from Active Model / Metamodel / Packages
  if (Array.isArray(stereotypes) && stereotypes.length > 0) {
    stereotypes.forEach((st) => {
      if (!st || !st.name) return;
      const baseType = st.base_type || 'ApplicationComponent';
      const layer = getElementLayer(baseType);
      const colors = ARCHIMATE_LAYER_COLORS[layer] || ARCHIMATE_LAYER_COLORS.Application;

      // Determine stencil preset or custom style
      let preset = MODERN_STENCIL_PRESETS.modern_card;
      if (st.stencil_shape && MODERN_STENCIL_PRESETS[st.stencil_shape]) {
        preset = MODERN_STENCIL_PRESETS[st.stencil_shape];
      } else if (st.name.toLowerCase().includes('microservice')) {
        preset = MODERN_STENCIL_PRESETS.modern_microservice;
      } else if (st.name.toLowerCase().includes('process') && baseType === 'BusinessProcess') {
        preset = MODERN_STENCIL_PRESETS.modern_process;
      } else if (st.name.toLowerCase().includes('k8s') || st.name.toLowerCase().includes('cluster') || baseType === 'Node') {
        preset = MODERN_STENCIL_PRESETS.modern_cloud_node;
      } else if (st.name.toLowerCase().includes('event') || st.name.toLowerCase().includes('queue') || st.name.toLowerCase().includes('stream')) {
        preset = MODERN_STENCIL_PRESETS.modern_event_stream;
      } else if (st.name.toLowerCase().includes('api') || st.name.toLowerCase().includes('gateway') || baseType === 'ApplicationInterface') {
        preset = MODERN_STENCIL_PRESETS.modern_api_interface;
      } else if (st.name.toLowerCase().includes('data') || st.name.toLowerCase().includes('database') || baseType === 'DataObject') {
        preset = MODERN_STENCIL_PRESETS.modern_database;
      } else if (st.name.toLowerCase().includes('decision') || baseType === 'Assessment') {
        preset = MODERN_STENCIL_PRESETS.modern_hex;
      }

      const glyph = (st.stencil_icon && STENCIL_ICON_GLYPHS[st.stencil_icon])
        ? STENCIL_ICON_GLYPHS[st.stencil_icon]
        : (preset === MODERN_STENCIL_PRESETS.modern_microservice ? '⚡'
          : preset === MODERN_STENCIL_PRESETS.modern_process ? '⚙️'
          : preset === MODERN_STENCIL_PRESETS.modern_cloud_node ? '☁️'
          : preset === MODERN_STENCIL_PRESETS.modern_event_stream ? '📦'
          : preset === MODERN_STENCIL_PRESETS.modern_database ? '🗄️'
          : preset === MODERN_STENCIL_PRESETS.modern_api_interface ? '⚡'
          : preset === MODERN_STENCIL_PRESETS.modern_hex ? '🏛️'
          : '✨');

      const stereoLabel = st.label || `«${st.name}»`;
      const displayLabel = `${stereoLabel}&#xa;${glyph} ${st.name}`;
      const style = st.custom_drawio_style || `${preset.style}fillColor=${colors.fill};strokeColor=${colors.stroke};fontColor=${colors.text};fontStyle=1;fontSize=12;`;
      const w = preset.width || 170;
      const h = preset.height || 70;

      const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="${displayLabel}" archimate_type="${baseType}" type="${baseType}" stereotype="${st.name}" stereotype_id="${st.id || ''}" layer="${layer}" id="elem"><mxCell style="${style}" vertex="1" parent="1"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell></object></root></mxGraphModel>`;

      libraryEntries.push({
        xml,
        w,
        h,
        title: `${glyph} ${stereoLabel} ${st.name} (${layer})`
      });

      processedStereoKeys.add(st.name.toLowerCase());
      if (st.id) processedStereoKeys.add(st.id.toLowerCase());
    });
  }

  // 2. Default Modern Stereotype Elements (ensures core modern stereotypes are always available)
  const defaultStereoDefs = [
    {
      id: 'stereo-microservice',
      name: 'Microservice',
      label: '«Microservice»',
      baseType: 'ApplicationComponent',
      layer: 'Application' as const,
      presetKey: 'modern_microservice',
      glyph: '⚡',
      defaultName: 'Nome Servizio'
    },
    {
      id: 'stereo-automated-process',
      name: 'Automated Process',
      label: '«Automated»',
      baseType: 'BusinessProcess',
      layer: 'Business' as const,
      presetKey: 'modern_process',
      glyph: '⚙️',
      defaultName: 'Processo Automatizzato'
    },
    {
      id: 'stereo-k8s',
      name: 'Kubernetes Cluster',
      label: '«K8s Cluster»',
      baseType: 'Node',
      layer: 'Technology' as const,
      presetKey: 'modern_cloud_node',
      glyph: '☁️',
      defaultName: 'Cluster Node / K8s'
    },
    {
      id: 'stereo-event-stream',
      name: 'Event Driven Service',
      label: '«Event Stream»',
      baseType: 'ApplicationComponent',
      layer: 'Application' as const,
      presetKey: 'modern_event_stream',
      glyph: '📦',
      defaultName: 'Topic / Event Bus'
    },
    {
      id: 'stereo-api-gw',
      name: 'API Gateway',
      label: '«API Gateway»',
      baseType: 'ApplicationInterface',
      layer: 'Application' as const,
      presetKey: 'modern_api_interface',
      glyph: '⚡',
      defaultName: 'REST / GraphQL Gateway'
    },
    {
      id: 'stereo-database',
      name: 'Database / Storage',
      label: '«Database»',
      baseType: 'DataObject',
      layer: 'Technology' as const,
      presetKey: 'modern_database',
      glyph: '🗄️',
      defaultName: 'Database / Data Store'
    },
    {
      id: 'stereo-domain-hex',
      name: 'Domain Core (DDD)',
      label: '«Domain Core»',
      baseType: 'ApplicationComponent',
      layer: 'Application' as const,
      presetKey: 'modern_hex',
      glyph: '🏛️',
      defaultName: 'Bounded Context'
    },
    {
      id: 'stereo-saas',
      name: 'SaaS Application',
      label: '«SaaS»',
      baseType: 'ApplicationComponent',
      layer: 'Application' as const,
      presetKey: 'modern_card',
      glyph: '☁️',
      defaultName: 'SaaS Solution'
    },
    {
      id: 'stereo-mainframe',
      name: 'Legacy Mainframe',
      label: '«Legacy Mainframe»',
      baseType: 'ApplicationComponent',
      layer: 'Application' as const,
      presetKey: 'modern_card',
      glyph: '🖥️',
      defaultName: 'Core Monolith'
    },
    {
      id: 'stereo-adr',
      name: 'Architecture Decision',
      label: '«Architecture Decision»',
      baseType: 'Assessment',
      layer: 'Motivation' as const,
      presetKey: 'modern_hex',
      glyph: '🛡️',
      defaultName: 'ADR Assessment'
    }
  ];

  defaultStereoDefs.forEach((def) => {
    if (processedStereoKeys.has(def.name.toLowerCase()) || processedStereoKeys.has(def.id.toLowerCase())) {
      return;
    }
    const preset = MODERN_STENCIL_PRESETS[def.presetKey] || MODERN_STENCIL_PRESETS.modern_card;
    const colors = ARCHIMATE_LAYER_COLORS[def.layer];
    const displayLabel = `${def.label}&#xa;${def.glyph} ${def.defaultName}`;
    const style = `${preset.style}fillColor=${colors.fill};strokeColor=${colors.stroke};fontColor=${colors.text};fontStyle=1;fontSize=12;`;
    const w = preset.width;
    const h = preset.height;
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="${displayLabel}" archimate_type="${def.baseType}" type="${def.baseType}" stereotype="${def.name}" stereotype_id="${def.id}" layer="${def.layer}" id="elem"><mxCell style="${style}" vertex="1" parent="1"><mxGeometry width="${w}" height="${h}" as="geometry"/></mxCell></object></root></mxGraphModel>`;

    libraryEntries.push({
      xml,
      w,
      h,
      title: `${def.glyph} ${def.label} ${def.name} (${def.layer})`
    });
  });

  return libraryEntries;
}

export interface CatalogElementItem {
  id: string;
  name: string;
  type: string;
  layer?: string;
  stereotype?: string;
  stereotype_id?: string;
  documentation?: string;
}

/**
 * Resolves shape styling based on standard ArchiMate vs Modern Stencil mode,
 * taking into account custom stereotype stencil definitions from packages.
 */
export function resolveElementDrawioStyle(
  elem: CatalogElementItem,
  stereotypes: any[] = [],
  stencilMode: 'standard' | 'modern' = 'standard'
): { shapeStyle: string; width: number; height: number; displayLabel: string } {
  const shapeMap = new Map<string, ArchimateShapeDef>();
  ARCHIMATE_SHAPES.forEach((s) => shapeMap.set(s.type, s));

  const shape = shapeMap.get(elem.type);
  const layer = (elem.layer || shape?.layer || 'Application') as keyof typeof ARCHIMATE_LAYER_COLORS;
  const colors = ARCHIMATE_LAYER_COLORS[layer] || ARCHIMATE_LAYER_COLORS.Application;

  let baseStyle = shape?.shapeStyle || 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;';
  let w = shape?.width || 160;
  let h = shape?.height || 65;
  let labelPrefix = '';

  // Find matching stereotype if any
  const matchedStereo = stereotypes.find(
    (st) =>
      (elem.stereotype_id && (st.id === elem.stereotype_id || st.name === elem.stereotype_id)) ||
      (elem.stereotype && (st.name === elem.stereotype || st.id === elem.stereotype || st.label === elem.stereotype))
  );

  // If Modern Mode is active (activatable option, keeping standard as default)
  if (stencilMode === 'modern') {
    if (matchedStereo) {
      if (matchedStereo.custom_drawio_style) {
        baseStyle = matchedStereo.custom_drawio_style;
      } else if (matchedStereo.stencil_shape && MODERN_STENCIL_PRESETS[matchedStereo.stencil_shape]) {
        const preset = MODERN_STENCIL_PRESETS[matchedStereo.stencil_shape];
        baseStyle = preset.style;
        w = preset.width;
        h = preset.height;
      } else {
        // Fallback modern card with layer colors
        baseStyle = MODERN_STENCIL_PRESETS.modern_card.style;
        w = MODERN_STENCIL_PRESETS.modern_card.width;
        h = MODERN_STENCIL_PRESETS.modern_card.height;
      }

      if (matchedStereo.stencil_icon && STENCIL_ICON_GLYPHS[matchedStereo.stencil_icon]) {
        labelPrefix = `${STENCIL_ICON_GLYPHS[matchedStereo.stencil_icon]} `;
      } else if (matchedStereo.label) {
        labelPrefix = `${matchedStereo.label}\n`;
      }
    } else {
      // Modernize standard shape with subtle shadow and rounded corners
      if (baseStyle.includes('rounded=1')) {
        baseStyle = MODERN_STENCIL_PRESETS.modern_card.style;
        w = 170;
        h = 70;
      } else {
        baseStyle = `${baseStyle}shadow=1;strokeWidth=1.5;`;
      }
    }
  }

  const finalStyle = `${baseStyle}fillColor=${colors.fill};strokeColor=${colors.stroke};fontColor=${colors.text};fontStyle=1;`;
  const displayLabel = labelPrefix ? `${labelPrefix}${elem.name}` : elem.name;

  return { shapeStyle: finalStyle, width: w, height: h, displayLabel };
}

/**
 * Builds Draw.io library entries from existing catalog elements in the workspace.
 * Allows architects to drag & drop existing elements into diagrams with their persistent easyea_id.
 * Standard ArchiMate is the default; Modern stencils can be activated.
 */
export function buildDrawioCatalogLibrary(
  elements: CatalogElementItem[],
  stereotypes: any[] = [],
  stencilMode: 'standard' | 'modern' = 'standard'
): any[] {
  if (!elements || elements.length === 0) return [];

  return elements.slice(0, 150).map((elem) => {
    const { shapeStyle, width, height, displayLabel } = resolveElementDrawioStyle(elem, stereotypes, stencilMode);
    const layer = elem.layer || 'Application';

    // XML representation with persistent easyea_id attribute for catalog linking & diffing
    const escapedName = (displayLabel || 'Senza Nome')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const escapedDoc = (elem.documentation || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><object label="${escapedName}" easyea_id="${elem.id}" archimate_type="${elem.type}" layer="${layer}" documentation="${escapedDoc}" id="elem_${elem.id}"><mxCell style="${shapeStyle}" vertex="1" parent="1"><mxGeometry width="${width}" height="${height}" as="geometry"/></mxCell></object></root></mxGraphModel>`;

    return {
      xml,
      w: width,
      h: height,
      title: `${elem.name} [${elem.type}]`
    };
  });
}

/**
 * Transforms an existing Draw.io diagram XML string according to the chosen stencil mode.
 * When targetMode is 'modern', existing ArchiMate elements in the diagram are updated with
 * subtle modern shadows, rounded corners (arcSize=14), crisp borders and custom stereotype shapes.
 * When targetMode is 'standard', shapes revert to official ArchiMate flat styling.
 */
export function transformDiagramXmlStencilMode(
  xml: string,
  targetMode: 'standard' | 'modern' = 'standard',
  stereotypes: any[] = []
): string {
  if (!xml || !xml.includes('<mxGraphModel')) return xml;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const cells = doc.querySelectorAll('mxCell[vertex="1"], object > mxCell');
    if (cells.length === 0) return xml;

    cells.forEach((cell) => {
      let style = cell.getAttribute('style') || '';
      if (!style) return;

      const parentObj = cell.parentElement?.tagName.toLowerCase() === 'object' ? cell.parentElement : null;
      const stereoAttr =
        parentObj?.getAttribute('stereotype') ||
        parentObj?.getAttribute('stereotype_id') ||
        parentObj?.getAttribute('stereotype_name') ||
        '';

      const matchedStereo = stereotypes.find(
        (st) =>
          stereoAttr &&
          (st.id === stereoAttr || st.name === stereoAttr || st.label === stereoAttr)
      );

      if (targetMode === 'modern') {
        if (matchedStereo?.custom_drawio_style) {
          style = matchedStereo.custom_drawio_style;
        } else if (matchedStereo?.stencil_shape && MODERN_STENCIL_PRESETS[matchedStereo.stencil_shape]) {
          const preset = MODERN_STENCIL_PRESETS[matchedStereo.stencil_shape];
          // Preserve layer colors if already defined
          const fillMatch = style.match(/fillColor=([^;]+)/);
          const strokeMatch = style.match(/strokeColor=([^;]+)/);
          const fontMatch = style.match(/fontColor=([^;]+)/);
          let colors = '';
          if (fillMatch) colors += `fillColor=${fillMatch[1]};`;
          if (strokeMatch) colors += `strokeColor=${strokeMatch[1]};`;
          if (fontMatch) colors += `fontColor=${fontMatch[1]};`;
          style = `${preset.style}${colors}fontStyle=1;`;
        } else {
          // General Modern Look & Feel enhancements:
          // 1. Shadow
          if (!style.includes('shadow=')) {
            style += ';shadow=1;';
          } else {
            style = style.replace(/shadow=0;?/g, 'shadow=1;');
          }

          // 2. Stroke width
          if (!style.includes('strokeWidth=')) {
            style += ';strokeWidth=1.5;';
          } else {
            style = style.replace(/strokeWidth=[0-9.]+;?/g, 'strokeWidth=1.5;');
          }

          // 3. Rounded corners & arc size
          if (!style.includes('rounded=')) {
            style += ';rounded=1;';
          }
          if (style.includes('arcSize=')) {
            style = style.replace(/arcSize=[0-9]+;?/g, 'arcSize=14;');
          } else {
            style += ';arcSize=14;';
          }

          // If square archimate shape, give it rounded corners
          if (style.includes('archiType=square')) {
            style = style.replace('archiType=square', 'archiType=rounded;arcSize=14');
          }
        }
      } else {
        // Revert to Standard ArchiMate
        style = style.replace(/shadow=1;?/g, '');
        style = style.replace(/strokeWidth=1.5;?/g, 'strokeWidth=1;');
        style = style.replace(/arcSize=14;?/g, 'arcSize=10;');
      }

      cell.setAttribute('style', style.replace(/;+/g, ';'));
    });

    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch (e) {
    console.warn('[ArchimatePalette] XML transformation error:', e);
    return xml;
  }
}

