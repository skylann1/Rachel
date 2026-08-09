import { ImageResponse } from 'next/og';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 13a8 8 0 0 1 16 0Z"
            fill="#f59e0b"
          />
          <rect x="2.5" y="13" width="19" height="2.6" rx="1.3" fill="#f8fafc" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
