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
