import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
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
          background: 'linear-gradient(135deg, #FF5A5F 0%, #FFB238 35%, #B14AE2 70%, #FF5DA2 100%)',
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#FFFFFF',
            fontFamily: 'sans-serif',
            display: 'flex',
            letterSpacing: -1,
          }}
        >
          MR
        </div>
      </div>
    ),
    { ...size },
  );
}
