import type { Metadata } from "next";
import { SixFigureDebtClient } from "./post-client";

const TITLE = "The six-figure debt that existed in no system";
const DESCRIPTION =
  "A payment provider said we owed them six figures. Our systems said we owed them nothing. Five scars from operating money movement on mutable tables — and the ledger principles each one burned in.";

export const metadata: Metadata = {
  title: `${TITLE} · LedgerCore`,
  description: DESCRIPTION,
  authors: [{ name: "Alexander Sanchez" }],
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "LedgerCore",
    publishedTime: "2026-07-28T00:00:00.000Z",
    authors: ["Alexander Sanchez"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SixFigureDebtPost() {
  return <SixFigureDebtClient />;
}
