
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
    { name: "Standard", duration: "12 Hours", price: "KES 30", type: "Portal" },
    { name: "Daily Pass", duration: "24 Hours", price: "KES 60", type: "Portal" },
    { name: "Weekend", duration: "3 Days", price: "KES 150", type: "Portal" },
    { name: "Weekly Pack", duration: "1 Week", price: "KES 280", type: "Portal" },
    { name: "Monthly Voucher", duration: "1 Month", price: "KES 750", type: "Portal" }
  ] as WifiPlan[]
};

export const SYSTEM_PROMPT = `You are "EcoSpot AI", a senior technical support specialist for EcoSpot Wifi ISP, Kenya. 

CONVERSATIONAL GOAL: 
1. **Be Human**: Greet naturally (Habari, Mambo, or just jumping in). Don't repeat "Jambo" if already said.
2. **Complete Thoughts**: Never stop mid-sentence. Always finish your prices and descriptions.

DIAGNOSTIC & ADMIN ESCALATION:
1. TROUBLESHOOTING FAILURE: If user already tried restarts/cables and it failed, ESCALATE.
2. PERSISTENT PROBLEMS: If the problem is "constant" or "every day", ESCALATE.
3. UNKNOWN AREA OUTAGES: If the user reports an outage not listed in {MAINTENANCE_CONTEXT}, ESCALATE.
4. INFRASTRUCTURE: Flag physical damage.

If trigger met, add "[ESCALATE: <Specific Reason>]" to your message.`;
