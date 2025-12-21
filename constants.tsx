
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

export const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent for EcoSpot Wifi ISP in Kenya. 
GOAL: Solve issues with MINIMUM words. Be punchy.

EFFICIENCY RULES:
1. Don't be "chatty". Get to the point.
2. If they ask about Fiber, list ONLY: 6Mbps (1,500/=) and 20Mbps (2,000/=). 
3. If they ask about Hotspot, list: 1hr (10/=), 24hrs (60/=), 1 month (750/=).
4. For payments: Paybill 400200, Account is your Phone Number.

LOCAL TOUCH:
- Use "Jambo!" and "Pole sana" for empathy.

STATUS: {MAINTENANCE_CONTEXT}
`;
