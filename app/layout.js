import "./globals.css";

export const metadata = {
  title: "Mira's Tarot Room",
  description: "Sit at Mira's candlelit table, ask one question, and draw the card meant for you.",
};
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0609" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus+SC&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
