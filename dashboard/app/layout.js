import './globals.css';

export const metadata = {
  title: 'Power Monitor — Real-Time AC Power Dashboard',
  description: 'Live power consumption monitoring with ESP32, ZMPT101B, and SCT-013 sensors',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
