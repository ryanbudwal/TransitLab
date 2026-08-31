import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: "TransitLab · Route intelligence studio",
  description:
    "Explore shortest-path algorithms and simulate disruptions across Alder City's transit network.",
  openGraph: {
    title: "TransitLab · Route intelligence studio",
    description:
      "Plan a route, disrupt the network, and watch the graph adapt.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TransitLab · Route intelligence studio",
    description:
      "Plan a route, disrupt the network, and watch the graph adapt.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
