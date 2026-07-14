import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talkova — AI English Tutor",
  description: "Practice English with a bilingual AI tutor built for Latino learners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
