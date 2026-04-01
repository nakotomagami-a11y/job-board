import type { Metadata } from "next";
import { ProfileProvider } from "@shared/providers/profile-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobHunt — AI-Powered Job Search",
  description:
    "Find frontend and mobile development positions matched to your skills. Powered by Claude.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}
