import React, { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import StudioFlowNode from './StudioFlowNode.jsx';
import { toReactFlowElements } from '../../library/studioGraph.js';

const nodeTypes = { studio: StudioFlowNode };

export default function StudioGraphView({ project }) {
  const elements = useMemo(() => toReactFlowElements(project), [project]);
  const [nodes, setNodes, onNodesChange] = useNodesState(elements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(elements.edges);

  useEffect(() => {
    setNodes(elements.nodes);
    setEdges(elements.edges);
  }, [elements, setNodes, setEdges]);

  return (
    <div className="studio-graph-host">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} color="#2a3140" />
        <Controls />
        <MiniMap pannable zoomable style={{ background: '#12151c' }} />
      </ReactFlow>
    </div>
  );
}
