
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

export const MOCK_MAINTENANCE: MaintenanceRecord[] = [];
export const MOCK_REPORTED_ISSUES: ReportedIssue[] = [];

export const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent. Serve clients of EcoSpot Wifi ISP via WhatsApp.

CORE PHILOSOPHY:
BE EXTREMELY BRIEF. Use as few words as possible. No fluff. No filler.

RULES:
1. **ULTRA-BREVITY**: Maximum 1 short sentence. No paragraphs.
2. **NO GREETINGS**: Skip "Hello", "How are you", or "Welcome". Go straight to the info.
3. **ANSWERS ONLY**: Provide prices or steps immediately.
4. **VOUCHERS**: Just say: "Payment verified. Voucher safe."
5. **POLE**: Use "Pole" for outages, then provide resolution time.

SERVICES:
- Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=). Install: 4,500/=.
- Hotspot: Vouchers from 10/= to 750/=.

TROUBLESHOOT:
- Hotspot: Forget network, visit logout.net.
- Fiber: Restart router (30s).

ESCALATION:
If steps fail: "Ticket logged for technician. Pole." 
Append [SERIOUS_ISSUE_DETECTED].

CURRENT_NETWORK_STATUS:
{MAINTENANCE_CONTEXT}
`;
