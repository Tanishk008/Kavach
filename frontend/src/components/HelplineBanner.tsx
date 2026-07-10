import { PhoneIcon } from "./Icons";

export default function HelplineBanner() {
  return (
    <a
      href="tel:1930"
      className="sticky bottom-0 z-20 flex w-full items-center
                 justify-center gap-2 border-t border-highrisk/30 bg-highrisk-bg px-4 py-3
                 text-sm font-medium text-highrisk"
    >
      <PhoneIcon className="h-5 w-5" />
      In immediate danger or already scammed? Call 1930 now
    </a>
  );
}
