'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';

// ===========================================
// QRCodeDisplay Component
// Generates and displays QR code for doctor check-in
// ===========================================

interface QRCodeDisplayProps {
  doctorId: string;
  doctorName: string;
  department: string;
  roomNumber: string;
}

export default function QRCodeDisplay({
  doctorId,
  doctorName,
  department,
  roomNumber,
}: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const checkInUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/check-in/${doctorId}`
      : `/check-in/${doctorId}`;

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(checkInUrl, {
          width: 280,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };
    generateQR();
  }, [checkInUrl]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${doctorName}</title>
        <style>
          body {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; min-height: 100vh; font-family: 'Inter', sans-serif;
            margin: 0; padding: 20px; background: #fff;
          }
          .header { text-align: center; margin-bottom: 24px; }
          .hospital-name { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px; }
          .title { font-size: 28px; font-weight: 700; color: #1a1a2e; margin: 8px 0; }
          .subtitle { font-size: 16px; color: #555; }
          .qr-wrapper { padding: 20px; border: 3px solid #1a1a2e; border-radius: 16px; margin: 20px 0; }
          .qr-wrapper img { display: block; }
          .info { text-align: center; margin-top: 16px; }
          .info p { margin: 4px 0; font-size: 14px; color: #555; }
          .scan-text { font-size: 18px; font-weight: 600; color: #0d9488; margin-top: 20px; }
          .url { font-size: 11px; color: #999; word-break: break-all; max-width: 300px; margin-top: 12px; }
          @media print { body { padding: 40px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="hospital-name">SVASTH Queue</p>
          <h1 class="title">${doctorName}</h1>
          <p class="subtitle">${department} · Room ${roomNumber}</p>
        </div>
        <div class="qr-wrapper">
          <img src="${qrDataUrl}" alt="QR Code" width="280" height="280" />
        </div>
        <p class="scan-text">📱 Scan to Join Queue</p>
        <div class="info">
          <p>Scan this QR code with your phone camera</p>
          <p>to register for your OPD appointment</p>
        </div>
        <p class="url">${checkInUrl}</p>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="qr-display">
      <div className="qr-card">
        <div className="qr-header">
          <h3>{doctorName}</h3>
          <p>{department} · Room {roomNumber}</p>
        </div>

        <div className="qr-image-wrapper">
          {qrDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qrDataUrl} alt={`QR Code for ${doctorName}`} className="qr-image" />
          ) : (
            <div className="qr-placeholder">
              <div className="spinner" />
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <p className="qr-instruction">Scan to join queue</p>

        <div className="qr-actions">
          <button onClick={handlePrint} className="btn btn-secondary btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print QR
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(checkInUrl)}
            className="btn btn-ghost btn-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
