import { DiagramViewDetail } from '../../types';
import { ARCHIMATE_SHAPES, ARCHIMATE_RELATIONSHIPS, ARCHIMATE_LAYER_COLORS } from './archimatePalette';

export interface DrawioParsedElement {
  id: string;
  elementId?: string;
  name: string;
  type: string;
  layer: string;
  documentation?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentId?: string;
  isNew?: boolean;
}

export interface DrawioParsedConnection {
  id: string;
  relationshipId?: string;
  name?: string;
  type: string;
  sourceNodeId: string;
  targetNodeId: string;
  isNew?: boolean;
}

export interface DrawioParseResult {
  nodes: DrawioParsedElement[];
  connections: DrawioParsedConnection[];
  addedElements: DrawioParsedElement[];
  updatedElements: DrawioParsedElement[];
  removedElements: string[]; // element IDs
}

/**
 * Escapes special XML characters.
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strips HTML formatting (e.g. <div>, <span>, <br>) and unescapes entities from Draw.io labels.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  let str = input;
  // If it's HTML-escaped like &lt;div&gt;
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&amp;')) {
    try {
      const doc = new DOMParser().parseFromString(str, 'text/html');
      str = doc.body.textContent || str;
    } catch {
      // ignore
    }
  }
  // Strip any remaining HTML tags and collapse whitespace
  return str.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Finds style for a given ArchiMate element type.
 */
function getShapeStyleForType(type: string, layer: string): { style: string; fill: string; stroke: string; fontColor: string } {
  const found = ARCHIMATE_SHAPES.find((s) => s.type.toLowerCase() === (type || '').toLowerCase());
  const lColors = ARCHIMATE_LAYER_COLORS[layer as keyof typeof ARCHIMATE_LAYER_COLORS] || ARCHIMATE_LAYER_COLORS.Application;

  if (found) {
    return {
      style: found.shapeStyle,
      fill: found.fillColor,
      stroke: found.strokeColor,
      fontColor: ARCHIMATE_LAYER_COLORS[found.layer]?.text || '#000000'
    };
  }

  return {
    style: 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
    fill: lColors.fill,
    stroke: lColors.stroke,
    fontColor: lColors.text
  };
}

/**
 * Finds edge style for a given ArchiMate relationship type.
 */
function getEdgeStyleForType(type: string): string {
  const found = ARCHIMATE_RELATIONSHIPS.find((r) => r.type.toLowerCase() === (type || '').toLowerCase());
  if (found) return found.style;
  return 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;strokeColor=#4F46E5;strokeWidth=2;';
}

/**
 * Converts EasyEA View Detail into standard Draw.io mxGraphModel XML.
 */
export function easyEAToDrawioXml(viewDetail: DiagramViewDetail): string {
  // If viewDetail already contains raw drawio_xml, reuse it directly to preserve layout
  if (viewDetail.drawio_xml && viewDetail.drawio_xml.includes('<mxGraphModel')) {
    return viewDetail.drawio_xml;
  }

  let xml = `<mxfile host="EasyEA Platform" modified="${new Date().toISOString()}" agent="EasyEA Draw.io Modeler" version="21.0.0" type="embed">\n`;
  xml += `  <diagram id="${escapeXml(viewDetail.id)}" name="${escapeXml(viewDetail.name || 'EasyEA Diagram')}">\n`;
  xml += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">\n`;
  xml += `      <root>\n`;
  xml += `        <mxCell id="0" />\n`;
  xml += `        <mxCell id="1" parent="0" />\n`;

  // Render Nodes as <object> elements with semantic metadata
  for (const node of viewDetail.nodes) {
    const { style, fill, stroke, fontColor } = getShapeStyleForType(node.type, node.layer);
    const cellStyle = `${style}fillColor=${fill};strokeColor=${stroke};fontColor=${fontColor};fontStyle=1;`;
    const w = node.width || 160;
    const h = node.height || 65;
    const x = node.x || 100;
    const y = node.y || 100;
    const parent = node.parent_id || '1';

    xml += `        <object id="${escapeXml(node.id)}" label="${escapeXml(stripHtml(node.name))}" easyea_id="${escapeXml(node.element_id || '')}" archimate_type="${escapeXml(node.type || 'ApplicationComponent')}" layer="${escapeXml(node.layer || 'Application')}" documentation="${escapeXml(stripHtml(node.documentation || ''))}">\n`;
    xml += `          <mxCell style="${cellStyle}" vertex="1" parent="${escapeXml(parent)}">\n`;
    xml += `            <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />\n`;
    xml += `          </mxCell>\n`;
    xml += `        </object>\n`;
  }

  // Render Connections as <object> edge elements
  for (const conn of viewDetail.connections) {
    const edgeStyle = getEdgeStyleForType(conn.type);
    xml += `        <object id="${escapeXml(conn.id)}" label="${escapeXml(stripHtml(conn.name || ''))}" relationship_id="${escapeXml(conn.relationship_id || '')}" archimate_rel_type="${escapeXml(conn.type || 'ServingRelationship')}">\n`;
    xml += `          <mxCell style="${edgeStyle}" edge="1" parent="1" source="${escapeXml(conn.source_node_id)}" target="${escapeXml(conn.target_node_id)}">\n`;
    xml += `            <mxGeometry relative="1" as="geometry" />\n`;
    xml += `          </mxCell>\n`;
    xml += `        </object>\n`;
  }

  xml += `      </root>\n`;
  xml += `    </mxGraphModel>\n`;
  xml += `  </diagram>\n`;
  xml += `</mxfile>`;

  return xml;
}

/**
 * Creates an empty Draw.io diagram template for a new view.
 */
export function createEmptyDrawioXml(title = 'New EasyEA Architecture View'): string {
  return `<mxfile host="EasyEA Platform" modified="${new Date().toISOString()}" agent="EasyEA Draw.io Modeler" version="21.0.0" type="embed">
  <diagram id="view-new" name="${escapeXml(title)}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * Parses a Draw.io XML string and extracts EasyEA nodes, connections, and metadata.
 */
export function drawioXmlToEasyEA(xmlString: string, originalView?: DiagramViewDetail | null): DrawioParseResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const nodes: DrawioParsedElement[] = [];
  const connections: DrawioParsedConnection[] = [];

  // 1. Process all <object> tags and <mxCell> tags
  const objects = Array.from(xmlDoc.querySelectorAll('object'));
  const standaloneMxCells = Array.from(xmlDoc.querySelectorAll('root > mxCell')).filter(
    (cell) => cell.getAttribute('id') !== '0' && cell.getAttribute('id') !== '1'
  );

  // Helper to parse cell
  const parseCellOrObject = (elem: Element, isObject: boolean) => {
    let id = elem.getAttribute('id') || `node-${Math.random().toString(36).substring(2, 9)}`;
    let rawLabel = elem.getAttribute('label') || elem.getAttribute('value') || '';
    let label = stripHtml(rawLabel);
    let easyeaId = elem.getAttribute('easyea_id') || undefined;
    let archimateType = elem.getAttribute('archimate_type') || 'ApplicationComponent';
    let layer = elem.getAttribute('layer') || 'Application';
    let documentation = stripHtml(elem.getAttribute('documentation') || '');
    let relType = elem.getAttribute('archimate_rel_type') || 'ServingRelationship';
    let relId = elem.getAttribute('relationship_id') || undefined;

    const cell = isObject ? elem.querySelector('mxCell') : elem;
    if (!cell) return;

    const isEdge = cell.getAttribute('edge') === '1';
    const isVertex = cell.getAttribute('vertex') === '1';
    const parentId = cell.getAttribute('parent') || '1';

    // Parse style hints if not an object or if generic
    const style = (cell.getAttribute('style') || '').toLowerCase();
    if (!isObject || !elem.getAttribute('archimate_type')) {
      if (style.includes('business') || style.includes('#ffffb5')) {
        layer = 'Business';
        if (style.includes('actor')) archimateType = 'BusinessActor';
        else if (style.includes('role')) archimateType = 'BusinessRole';
        else if (style.includes('process')) archimateType = 'BusinessProcess';
        else if (style.includes('function')) archimateType = 'BusinessFunction';
        else if (style.includes('service')) archimateType = 'BusinessService';
        else if (style.includes('event')) archimateType = 'BusinessEvent';
        else if (style.includes('object')) archimateType = 'BusinessObject';
        else archimateType = 'BusinessProcess';
      } else if (style.includes('technology') || style.includes('#c9e7b7')) {
        layer = 'Technology';
        if (style.includes('node') || style.includes('cube')) archimateType = 'Node';
        else if (style.includes('device')) archimateType = 'Device';
        else if (style.includes('system') || style.includes('cylinder')) archimateType = 'SystemSoftware';
        else if (style.includes('service')) archimateType = 'TechnologyService';
        else if (style.includes('artifact')) archimateType = 'Artifact';
        else archimateType = 'Node';
      } else if (style.includes('motivation') || style.includes('#ccccff')) {
        layer = 'Motivation';
        if (style.includes('goal')) archimateType = 'Goal';
        else if (style.includes('principle')) archimateType = 'Principle';
        else if (style.includes('requirement')) archimateType = 'Requirement';
        else if (style.includes('driver')) archimateType = 'Driver';
        else if (style.includes('stakeholder')) archimateType = 'Stakeholder';
        else archimateType = 'Goal';
      } else if (style.includes('strategy') || style.includes('#f5deaa')) {
        layer = 'Strategy';
        if (style.includes('capability')) archimateType = 'Capability';
        else if (style.includes('resource')) archimateType = 'Resource';
        else if (style.includes('value')) archimateType = 'ValueStream';
        else archimateType = 'Capability';
      } else {
        layer = 'Application';
        if (style.includes('component')) archimateType = 'ApplicationComponent';
        else if (style.includes('interface')) archimateType = 'ApplicationInterface';
        else if (style.includes('service')) archimateType = 'ApplicationService';
        else if (style.includes('process')) archimateType = 'ApplicationProcess';
        else if (style.includes('data')) archimateType = 'DataObject';
        else archimateType = 'ApplicationComponent';
      }
    }

    if (isVertex) {
      const geo = cell.querySelector('mxGeometry');
      const x = geo ? parseFloat(geo.getAttribute('x') || '0') : 0;
      const y = geo ? parseFloat(geo.getAttribute('y') || '0') : 0;
      const width = geo ? parseFloat(geo.getAttribute('width') || '160') : 160;
      const height = geo ? parseFloat(geo.getAttribute('height') || '65') : 65;

      nodes.push({
        id,
        elementId: easyeaId,
        name: label || 'Unnamed Element',
        type: archimateType,
        layer,
        documentation,
        x,
        y,
        width,
        height,
        parentId: parentId !== '1' && parentId !== '0' ? parentId : undefined,
        isNew: !easyeaId
      });
    } else if (isEdge) {
      const source = cell.getAttribute('source') || '';
      const target = cell.getAttribute('target') || '';

      // Infer relationship type from style if not explicitly specified
      if (!isObject || !elem.getAttribute('archimate_rel_type')) {
        if (style.includes('realization') || (style.includes('dashed=1') && style.includes('endarrow=block'))) {
          relType = 'RealizationRelationship';
        } else if (style.includes('assignment') || (style.includes('startarrow=oval') || style.includes('endarrow=oval'))) {
          relType = 'AssignmentRelationship';
        } else if (style.includes('composition') || (style.includes('startarrow=diamond') && style.includes('startfill=1'))) {
          relType = 'CompositionRelationship';
        } else if (style.includes('aggregation') || (style.includes('startarrow=diamond') && (style.includes('startfill=0') || !style.includes('startfill=1')))) {
          relType = 'AggregationRelationship';
        } else if (style.includes('access') || (style.includes('dashed=1') && style.includes('endarrow=open'))) {
          relType = 'AccessRelationship';
        } else if (style.includes('triggering') || (style.includes('endarrow=classic') && !style.includes('dashed=1'))) {
          relType = 'TriggeringRelationship';
        } else if (style.includes('flow') || (style.includes('dashed=1') && style.includes('endarrow=classic'))) {
          relType = 'FlowRelationship';
        } else if (style.includes('specialization') || (style.includes('endarrow=block') && !style.includes('dashed=1'))) {
          relType = 'SpecializationRelationship';
        } else if (style.includes('association') || style.includes('endarrow=none')) {
          relType = 'AssociationRelationship';
        } else if (style.includes('serving') || style.includes('endarrow=open')) {
          relType = 'ServingRelationship';
        }
      }

      if (source && target) {
        connections.push({
          id,
          relationshipId: relId,
          name: label,
          type: relType,
          sourceNodeId: source,
          targetNodeId: target,
          isNew: !relId
        });
      }
    }
  };

  for (const obj of objects) {
    parseCellOrObject(obj, true);
  }

  for (const cell of standaloneMxCells) {
    // If not already inside an <object>
    if (cell.parentElement?.tagName.toLowerCase() !== 'object') {
      parseCellOrObject(cell, false);
    }
  }

  // Calculate diff with original view
  const originalNodeIds = new Set(originalView?.nodes.map((n) => n.id) || []);
  const currentNodeIds = new Set(nodes.map((n) => n.id));

  const addedElements = nodes.filter((n) => !originalNodeIds.has(n.id) || n.isNew);
  const updatedElements = nodes.filter((n) => originalNodeIds.has(n.id));
  const removedElements = (originalView?.nodes || [])
    .filter((n) => !currentNodeIds.has(n.id))
    .map((n) => n.element_id || n.id);

  return {
    nodes,
    connections,
    addedElements,
    updatedElements,
    removedElements
  };
}
