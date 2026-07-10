import { Routes, Route, Navigate } from "react-router-dom";
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
import RiskMap from "./pages/RiskMap";
import BlockPhone from "./pages/BlockPhone";
import ReportScam from "./pages/ReportScam";
import HelplineInfo from "./pages/HelplineInfo";
import SafetyTips from "./pages/SafetyTips";

// Route table mapping every UI-spec screen to its page component.
export default function App() {
  return (
    <>
      {/* Extra corner brackets — top-right and bottom-left (the other two are in CSS ::before/::after) */}
      <div className="phone-corner phone-corner--tr" />
      <div className="phone-corner phone-corner--bl" />

      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />
        <Route path="/otp" element={<OtpVerify />} />
        <Route path="/setup" element={<ProfileSetup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/check-number" element={<CheckNumber />} />
        <Route path="/check-message" element={<CheckMessage />} />
        <Route path="/check-pay" element={<CheckBeforePay />} />
        <Route path="/check-currency" element={<CheckCurrency />} />
        <Route path="/risk-map" element={<RiskMap />} />
        <Route path="/block-phone" element={<BlockPhone />} />
        <Route path="/report" element={<ReportScam />} />
        <Route path="/helpline" element={<HelplineInfo />} />
        <Route path="/about" element={<HelplineInfo />} />
        <Route path="/safety" element={<SafetyTips />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}
