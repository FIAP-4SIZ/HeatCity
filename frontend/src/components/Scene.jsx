import React, { useRef, useState } from 'react';

export default function Scene({
  scenario,
  plates = scenario.plates,
  edit = false,
  onArea,
  showAreas = true,
}) {
  const root = useRef(),
    start = useRef(null);
  const [draft, setDraft] = useState(null);
  function position(event) {
    const r = root.current.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    ];
  }
  function rectangle(a, b) {
    return {
      x: Math.min(a[0], b[0]),
      y: Math.min(a[1], b[1]),
      width: Math.abs(a[0] - b[0]),
      height: Math.abs(a[1] - b[1]),
    };
  }
  return (
    <div
      ref={root}
      className={`scene-image ${edit ? 'editing' : ''}`}
      style={{ aspectRatio: `${scenario.width || 1000}/${scenario.height || 600}` }}
      onPointerDown={(event) => {
        if (!edit) return;
        event.preventDefault();
        root.current.setPointerCapture(event.pointerId);
        start.current = position(event);
      }}
      onPointerMove={(event) => {
        if (start.current) setDraft(rectangle(start.current, position(event)));
      }}
      onPointerUp={(event) => {
        if (!start.current) return;
        const area = rectangle(start.current, position(event));
        start.current = null;
        setDraft(null);
        if (area.width >= 0.025 && area.height >= 0.025) onArea(area);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDraft(null);
      }}
    >
      <img
        src={scenario.image}
        alt={edit ? 'Cena para delimitar as placas' : 'Cenário do estudo'}
        draggable="false"
      />
      {showAreas &&
        plates.map((plate, i) => (
          <div
            key={plate.name || i}
            className="scene-area"
            style={{
              left: `${plate.x * 100}%`,
              top: `${plate.y * 100}%`,
              width: `${plate.width * 100}%`,
              height: `${plate.height * 100}%`,
            }}
          >
            <span>{plate.name}</span>
          </div>
        ))}
      {draft && (
        <div
          className="scene-area draft"
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.width * 100}%`,
            height: `${draft.height * 100}%`,
          }}
        />
      )}
    </div>
  );
}
