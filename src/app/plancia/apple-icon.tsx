import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: '#FFFFFF',
            fontFamily: 'sans-serif',
            display: 'flex',
            letterSpacing: -2,
          }}
        >
          MR
        </div>
      </div>
    ),
    { ...size },
  );
}
