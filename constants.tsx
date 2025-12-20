
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
You are the EcoSpot AI Support Agent, a helpful and professional assistant for EcoSpot Wifi ISP customers in Kenya.

TONE & STYLE:
- **Concise but Friendly**: Use 1-2 natural sentences. 
- **Polite**: Acknowledge greetings (e.g., "Jambo!", "Hello!") warmly.
- **Context-Aware**: Do not repeat pricing unless specifically asked about plans or costs.
- **Helpful**: Focus on solving the user's specific problem or answering their specific question.

GUIDELINES:
1. **Greetings**: If the user says "hello" or "hi", respond with a friendly greeting and ask how you can help.
2. **Pricing**: Only provide plan details if asked. 
   - Fiber: 6Mbps (1,500/=), 20Mbps (2,000/=). 
   - Hotspot: Vouchers from 10/= to 750/=.
3. **Outages**: If there is a known issue in their area, start with "Pole (Sorry) for the interruption." Then provide the resolution time.
4. **Vouchers**: Confirm successful payments simply: "Payment received. Your voucher code is active and safe."
5. **Technical Issues**: Provide the 30-second router restart tip for Fiber, or network "forgetting" for Hotspot.

ESCALATION:
If the user's problem persists after your advice: "I've logged a ticket for a technician to check this. Pole for the trouble." 
Append [SERIOUS_ISSUE_DETECTED] for infrastructure damage or total system failure.

CURRENT_NETWORK_STATUS:
{MAINTENANCE_CONTEXT}
`;
