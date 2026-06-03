import './globals.css';

export const metadata = {
  title: '⚡ Power Monitor — Real-Time AC Power & Cost Dashboard',
  description: 'Live electricity monitoring with ESP32, ZMPT101B, and SCT-013 sensors. Track voltage, current, power, and electricity cost in real-time.',
  keywords: ['power monitor', 'energy meter', 'ESP32', 'Supabase', 'IoT', 'electricity cost'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
