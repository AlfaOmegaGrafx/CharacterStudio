import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const STATUS_CLASS = {
  idle: 'studio-status-idle',
  ready: 'studio-status-ready',
  running: 'studio-status-running',
  completed: 'studio-status-completed',
  failed: 'studio-status-failed',
};

function StudioFlowNode({ data }) {
  const status = data?.status || 'idle';
  return (
    <div className={`studio-flow-node ${STATUS_CLASS[status] || ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="studio-flow-node-kind">{data?.stage}</div>
      <div className="studio-flow-node-label">{data?.label}</div>
      <div className="studio-flow-node-status">{status}</div>
      {data?.payload?.imageUrl ? (
        <div className="studio-flow-node-hint">image ready</div>
      ) : null}
      {data?.payload?.meshUrl ? (
        <div className="studio-flow-node-hint">mesh ready</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(StudioFlowNode);
