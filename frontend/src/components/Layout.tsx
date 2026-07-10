import { ReactNode, useState } from "react";
import Header from "./Header";
import SideMenu from "./SideMenu";
import HelplineBanner from "./HelplineBanner";

export default function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative flex flex-col" style={{ height: "844px" }}>
      <Header onMenu={() => setMenuOpen(true)} />
      {/* Scrollable content area — fills remaining space between header and banner */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {children}
      </main>
      <HelplineBanner />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
