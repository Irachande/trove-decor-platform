import type { Metadata } from "next";
import DecorApp from "./DecorApp";

export const metadata: Metadata = {
  title: "Trove — Inventory for decorators",
  description:
    "Manage décor inventory, reservations, teams, and trusted local rentals in one beautiful workspace.",
};

export default function Home() {
  return <DecorApp />;
}
