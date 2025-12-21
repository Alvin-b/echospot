
import { WifiPlan, MaintenanceRecord, ReportedIssue } from './types';

export const ECO_SPOT_INFO = {
  name: "EcoSpot Wifi ISP",
  installationFee: "KES 4,500",
  monthlyPlans: [
    { name: "Eco Basic", speed: "6 Mbps", price: "KES 1,500", type: "Monthly" },
    { name: "Eco Pro", speed: "20 Mbps", price: "KES 2,000", type: "Monthly" }
  ] as WifiPlan[],
  portalPlans: [
    { name: "Quick Browse", duration: "1 Hour", price: "KES 10", type: "Portal" },
    { name: "Day Half", duration: "12 Hours", price: "KES 30", type: "Portal" },
    { name: "Daily Pass", duration: "24 Hours", price: "KES 60", type: "Portal" },
    { name: "3-Day Pack", duration: "3 Days", price: "KES 150", type: "Portal" },
    { name: "Weekly Pack", duration: "1 Week", price: "KES 280", type: "Portal" },
    { name: "Monthly Voucher", duration: "1 Month", price: "KES 750", type: "Portal" }
  ] as WifiPlan[]
};

export const SYSTEM_PROMPT = `Role: EcoSpot ISP Support (Kenya). 
Rule: Strict one-sentence limit. No fluff/pleasantries. 
Fiber: 6Mbps (1500), 20Mbps (2000). 
Hotspot: 1hr (10), 24hrs (60). 
Paybill: 400200 (Acc: Phone No). 
No Internet: Is the LOS light red? 
Slow: Restart router.
Status: {MAINTENANCE_CONTEXT}`;
