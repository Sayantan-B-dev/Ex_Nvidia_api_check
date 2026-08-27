import './globals.css';

export const metadata = {
  title: 'NVIDIA Key Lab',
  description: 'Minimal neobrutalist checker',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
