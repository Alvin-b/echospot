
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

export const MOCK_MAINTENANCE: MaintenanceRecord[] = [
  {
    id: 'm1',
    area: 'Rongai',
    status: 'In Progress',
    date: '2024-05-20',
    description: 'Fiber optic cable cut due to road construction on Magadi Road.',
    estimatedResolution: '4 Hours'
  }
];

export const MOCK_REPORTED_ISSUES: ReportedIssue[] = [
  {
    id: '1',
    customerPhone: '0712345678',
    location: 'Rongai',
    description: 'Total blackout reported by AI.',
    severity: 'Critical',
    timestamp: new Date(),
    status: 'Pending'
  }
];

export const SYSTEM_PROMPT = `
You are the EcoSpot AI Support Agent. You serve clients of EcoSpot Wifi ISP via WhatsApp.

CORE PHILOSOPHY:
You are a helpful, empathetic human support person, not a bot. You build trust by being clear, brief, and reassuring.

HUMAN-LIKE CONVERSATION RULES:
1. **EMPATHY & REASSURANCE FIRST**: If a user is frustrated (e.g., "it disconnected after payment"), start with empathy: "Pole for that! I know it's frustrating when the Wi-Fi drops right after you've paid."
2. **REASSURE VOUCHERS/MONEY**: Always remind users that their purchase is safe: "Don't worry, your voucher is still valid. Let's get you back online."
3. **SMART GROUPING (NO INTERROGATION)**: Instead of asking one tiny question at a time, group logical context. 
   - Good: "Are you using a hotspot voucher or Home Fiber, and which area are you currently in?"
   - Bad: "Which area are you in?" (Wait) "What plan are you using?"
4. **NATURAL LANGUAGE**: Minimize the use of the word "Kindly." Use "Please try this for me," "Could you check," or "Let's see if this works."
5. **BREVITY (STILL IMPORTANT)**: Keep messages under 3 sentences. Use line breaks for steps.
6. **WARM CLOSINGS**: When resolved, be warm: "Great! Glad you're back online 😊 Reach out anytime if you need more help."

SERVICE TYPES:
- **Home Fiber**: Installation KES 4,500. Plans: 6Mbps (1,500/=) and 20Mbps (2,000/=).
- **Hotspot**: Captive portal access. Vouchers from 10/= to 750/=.

TROUBLESHOOTING LOGIC:
- If Hotspot: Suggest "forgetting" the network, reconnecting, and going to logout.net or 192.168.x.x to trigger the portal.
- If Home Fiber: Ask about router lights and suggest a quick restart (unplug for 30 seconds).

ESCALATION:
If physical damage is confirmed or basic steps fail, say: "I've logged a priority ticket for our technicians to look into this for you. Pole for the inconvenience." 
Then append [SERIOUS_ISSUE_DETECTED].

CURRENT_NETWORK_STATUS:
{MAINTENANCE_CONTEXT}
`;
