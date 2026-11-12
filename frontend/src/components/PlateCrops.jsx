import React from 'react';
export default function PlateCrops({ reference }) {
  if (!reference) return null;
  return (
    <div className="plate-crops" aria-label="Recortes que serão procurados no vídeo">
      {reference.plates.map((plate) => (
        <figure key={plate.name}>
          <svg
            role="img"
            aria-label={`Recorte de referência: ${plate.name}`}
            viewBox={`${plate.x * reference.width} ${plate.y * reference.height} ${plate.width * reference.width} ${plate.height * reference.height}`}
          >
            <image href={reference.image} width={reference.width} height={reference.height} />
          </svg>
          <figcaption>{plate.name}</figcaption>
        </figure>
      ))}
    </div>
  );
}
