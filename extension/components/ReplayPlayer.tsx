// rrweb 回放播放器封装
import React, { useLayoutEffect, useRef } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { eventWithTime } from '@rrweb/types';

interface Props {
  events: eventWithTime[];
  width?: number;
  height?: number;
  autoPlay?: boolean;
  hideHint?: boolean;
  /** 创建完成后回传 rrwebPlayer 实例（内含 getReplayer()） */
  onReady?: (player: any) => void;
}

export default function ReplayPlayer({
  events,
  width = 720,
  height = 450,
  autoPlay = false,
  hideHint = false,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || events.length === 0) return;
    // 防御 dev/HMR 下容器未挂在 document 上时被 mount
    if (!container.isConnected) return;

    // 已存在实例时先清理，避免重复初始化
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {
        // ignore
      }
      playerRef.current = null;
    }
    container.innerHTML = '';

    playerRef.current = new rrwebPlayer({
      target: container,
      props: {
        events,
        width,
        height,
        autoPlay,
        showController: true,
      },
    });
    onReady?.(playerRef.current);

    return () => {
      try {
        playerRef.current?.pause?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
      if (container && container.isConnected) {
        container.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (events.length === 0) {
    return <div style={{ color: '#999' }}>No recording in this submission</div>;
  }

  return (
    <div>
      {!hideHint && (
        <div style={{ color: '#666', marginBottom: 8 }}>
          {events.length} recorded events (DOM actions + captured Network/Console
          timeline)
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
