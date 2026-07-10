import logoUrl from "../../photo.png.jpeg";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export const KavachLogo = ({ className = "h-24 w-24", showWordmark = false }: LogoProps) => (
  <img
    className={className}
    src={logoUrl}
    alt={showWordmark ? "Kavach" : "Kavach logo"}
  />
);

export const IndianMonumentStrip = ({ className = "" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 420 112"
    fill="currentColor"
    aria-hidden="true"
    preserveAspectRatio="none"
  >
    <path d="M0 101h420v11H0z" />
    <path d="M19 101V55h34v46H19Zm8-46V43h18v12H27Zm5 46V78a4 4 0 0 1 8 0v23H32Z" />
    <path d="M78 101V61h46v40H78Zm9-40c0-12 7-21 14-21s14 9 14 21H87Zm7 40V82c0-9 14-9 14 0v19H94Z" />
    <path d="M147 101V49h48v52h-48Zm7-52 17-20 17 20h-34Zm9 52V73h16v28h-16Z" />
    <path d="M215 101V58h58v43h-58Zm7-43V45h10v13h-10Zm34 0V45h10v13h-10Zm-22 43V80c0-8 20-8 20 0v21h-20Z" />
    <path d="M294 101V61h80v40h-80Zm8-40V47h12v14h-12Zm52 0V47h12v14h-12Zm-35 40V78c0-9 30-9 30 0v23h-30Z" />
    <path d="M386 101V53h22v48h-22Zm6-48V38h10v15h-10Z" />
  </svg>
);
