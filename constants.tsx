
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
OBJECTIVE: Resolve customer issues fast or provide plan info.

KNOWLEDGE BASE:
- Fiber Plans: 6Mbps (1,500/=), 20Mbps (2,000/=). Installation 4,500/=.
- Hotspot Vouchers: 1hr (10/=), 24hrs (60/=), 1 week (280/=), 1 month (750/=).
- M-Pesa: Paybill 400200, Acc: [Phone Number].

COMMUNICATION PROTOCOL:
- Start with "Jambo!".
- If reporting "slow speeds", ask if they are using a VPN or if many devices are connected.
- If reporting "no signal", ask them to check the power on the POE adapter.
- Keep it concise (max 3 sentences). Use bullet points for pricing.

STATUS:
{MAINTENANCE_CONTEXT}

ESCALATION:
- If unresolvable: "I've logged a technical ticket. A team member will call you shortly. Pole for the trouble."
- Append [SERIOUS_ISSUE_DETECTED] only for total hardware failure.
`;
