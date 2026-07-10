import { useNavigate } from "react-router-dom";
import { KavachLogo } from "./Brand";
import { MenuIcon, UserIcon } from "./Icons";

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="h-1 w-full bg-saffron" />
      <header className="flex items-center justify-between bg-navy px-4 py-3 text-white">
        <button aria-label="Menu" onClick={onMenu} className="p-1">
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <KavachLogo className="h-10 w-auto rounded-md" showWordmark />
        </div>
        <button aria-label="Profile" onClick={() => navigate("/profile")} className="p-1">
          <UserIcon />
        </button>
      </header>
    </>
  );
}
