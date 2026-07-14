import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import OtpVerify from "./pages/OtpVerify";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CheckNumber from "./pages/CheckNumber";
import CheckMessage from "./pages/CheckMessage";
import CheckBeforePay from "./pages/CheckBeforePay";
import CheckCurrency from "./pages/CheckCurrency";
import CheckUpi from "./pages/CheckUpi";
import RiskMap from "./pages/RiskMap";
import BlockPhone from "./pages/BlockPhone";
import ReportScam from "./pages/ReportScam";
import HelplineInfo from "./pages/HelplineInfo";
import SafetyTips from "./pages/SafetyTips";
import History from "./pages/History";
import WhatsAppBot from "./pages/WhatsAppBot";

// Wrap each page in a slide/fade transition
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

// Route table mapping every UI-spec screen to its page component.
export default function App() {
  const location = useLocation();

  return (
    <>
      {/* Extra corner brackets — top-right and bottom-left (the other two are in CSS ::before/::after) */}
      <div className="phone-corner phone-corner--tr" />
      <div className="phone-corner phone-corner--bl" />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Splash /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/otp" element={<PageTransition><OtpVerify /></PageTransition>} />
          <Route path="/setup" element={<PageTransition><ProfileSetup /></PageTransition>} />
          <Route path="/home" element={<PageTransition><Home /></PageTransition>} />
          <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
          <Route path="/check-number" element={<PageTransition><CheckNumber /></PageTransition>} />
          <Route path="/check-message" element={<PageTransition><CheckMessage /></PageTransition>} />
          <Route path="/check-pay" element={<PageTransition><CheckBeforePay /></PageTransition>} />
          <Route path="/check-currency" element={<PageTransition><CheckCurrency /></PageTransition>} />
          <Route path="/check-upi" element={<PageTransition><CheckUpi /></PageTransition>} />
          <Route path="/risk-map" element={<PageTransition><RiskMap /></PageTransition>} />
          <Route path="/block-phone" element={<PageTransition><BlockPhone /></PageTransition>} />
          <Route path="/report" element={<PageTransition><ReportScam /></PageTransition>} />
          <Route path="/history" element={<PageTransition><History /></PageTransition>} />
          <Route path="/helpline" element={<PageTransition><HelplineInfo /></PageTransition>} />
          <Route path="/about" element={<PageTransition><HelplineInfo /></PageTransition>} />
          <Route path="/safety" element={<PageTransition><SafetyTips /></PageTransition>} />
          <Route path="/whatsapp-bot" element={<PageTransition><WhatsAppBot /></PageTransition>} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
