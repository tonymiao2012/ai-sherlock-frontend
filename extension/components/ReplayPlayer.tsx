// rrweb 回放播放器封装
import React, { useEffect, useRef } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import type { eventWithTime } from '@rrweb/types';

interface Props {
  events: eventWithTime[];
}

export default function ReplayPlayer({ events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || events.length === 0) return;
    containerRef.current.innerHTML = '';
    playerRef.current = new rrwebPlayer({
      target: containerRef.current,
      props: {
        events,
        width: 720,
        height: 450,
        autoPlay: false,
        showController: true,
      },
    });
    return () => {
      containerRef.current!.innerHTML = '';
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (events.length === 0) {
    return <div style={{ color: '#999' }}>No recording in this submission</div>;
  }

  return (
    <div>
      <div style={{ color: '#666', marginBottom: 8 }}>
        {events.length} recorded events (DOM actions + captured Network/Console
        timeline)
      </div>
      <div ref={containerRef} />
    </div>
  );
}
