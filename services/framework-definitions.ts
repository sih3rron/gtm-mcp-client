import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// services/framework-definitions.ts

// Core Framework Interfaces
export interface FrameworkComponent {
    name: string;
    description: string;
    weight?: number;
    subComponents: SubComponent[];
}

export interface SubComponent {
    name: string;
    description: string;
    weight?: number;
    keywords: string[];
    scoringCriteria: {
        excellent: string; // 9-10
        good: string;      // 7-8
        fair: string;      // 5-6
        poor: string;      // 1-4
    };
    coachingTips?: string[];
}

export interface FrameworkDefinition {
    name: string;
    displayName?: string; // NEW: from your files
    description: string;
    version?: string; // NEW: from your files
    category?: string; // NEW: from your files
    components: FrameworkComponent[];
    analysisMetadata?: { // NEW: from your files
        totalPossibleScore: number;
        scoringScale: Record<string, number>;
        frameworkApplication: string;
        lastUpdated: string;
    };
}

// Analysis Result Interfaces
export interface SubComponentScore {
    name: string;
    score: number|null; 
    evidence: string[];
    qualitativeAssessment: string;
    improvementSuggestions: string[];
}

export interface ComponentAnalysis {
    name: string;
    overallScore: number|null; // Average of sub-component scores
    subComponents: SubComponentScore[];
    keyFindings: string[];
}

export interface CallAnalysis {
    callId: string;
    callTitle: string;
    callUrl: string;
    callDate: string;
    participants: string[];
    duration: string;
    framework: string;
    overallScore: number | null; // Average of all component scores, null if unable to score
    analysisStatus: 'completed' | 'error' | 'incomplete'; // NEW: Track why null
    errorReason?: string; // NEW: Explain error if status is error/incomplete
    components: ComponentAnalysis[];
    executiveSummary: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    };
    followUpCallPlanning: FollowUpCallPlanning;
}


export interface AggregateAnalysis {
    totalCalls: number;
    scoredCalls: number;
    frameworks: string[];
    overallScore: number | null; // Average of all call scores, null if unable to score
    callAnalyses: CallAnalysis[];
    aggregateInsights: {
        strengthsAcrossCalls: string[];
        weaknessesAcrossCalls: string[];
        improvementOpportunities: string[];
        frameworkComparison?: {
            commandOfMessage?: number;
            greatDemo?: number;
            insights: string[];
        };
    };
    recommendations: {
        immediate: string[];
        strategic: string[];
        coaching: string[];
    };
}

export interface CustomerCitation {
    speaker: string;
    timestamp?: string;
    quote: string;
    context?: string;
}

export interface FollowUpCallPlanning {
    overallStrategy: string;
    deeperInquiryAreas: Array<{
        area: string;
        reason: string;
        suggestedQuestions: string[];
        priority: 'high' | 'medium' | 'low';
        supportingEvidence: CustomerCitation[];
    }>;
    unansweredQuestions: Array<{
        question: string;
        context: string;
        frameworkComponent: string;
        originalCustomerResponse?: CustomerCitation;
        whyIncomplete: string;
    }>;
    discoveryGaps: Array<{
        gapArea: string;
        impact: string;
        discoveryApproach: string;
        indicatorQuotes: CustomerCitation[];
    }>;
    stakeholderMapping: {
        currentParticipants: string[];
        missingStakeholders: string[];
        recommendedInvites: string[];
        evidenceOfNeed: CustomerCitation[];
    };
    nextCallObjectives: Array<{
        objective: string;
        rationale: string;
        customerEvidence: CustomerCitation[];
    }>;
    opportunityIndicators: Array<{
        indicator: string;
        customerQuote: CustomerCitation;
        followUpAction: string;
        potentialValue: string;
    }>;
}

const frameworkCache: Map<string, FrameworkDefinition> = new Map();

// Command of Message Framework Definition
export const COMMAND_OF_THE_MESSAGE_FRAMEWORK: FrameworkDefinition = {
    name: "Command of the Message",
    description: "A framework for identifying and articulating customer current state, desired state, and business value",
    components: [
        {
            name: "Current State / Desired State",
            description: "Identification and understanding of where the customer is today vs where they want to be",
            subComponents: [
                {
                    name: "Current State Clarity",
                    description: "How clearly the current situation, challenges, and pain points are identified",
                    keywords: ["current", "today", "currently", "now", "existing", "as-is", "pain", "challenge", "problem", "struggle"],
                    scoringCriteria: {
                        excellent: "Current state is explicitly articulated with specific details, metrics, and concrete examples",
                        good: "Current state is clearly identified with some supporting details or examples",
                        fair: "Current state is mentioned but lacks detail or specificity",
                        poor: "Current state is vague, assumed, or not explicitly discussed"
                    }
                },
                {
                    name: "Desired State Articulation",
                    description: "How clearly the target future state and goals are defined",
                    keywords: ["goal", "target", "desired", "want", "need", "vision", "future", "ideal", "objective", "aim"],
                    scoringCriteria: {
                        excellent: "Desired state is clearly defined with specific, measurable outcomes and timelines",
                        good: "Desired state is well-articulated with clear goals and some specificity",
                        fair: "Desired state is mentioned but lacks clarity or specific outcomes",
                        poor: "Desired state is vague, assumed, or not explicitly discussed"
                    }
                }
            ]
        },
        {
            name: "Positive Business Outcomes / Negative Consequences",
            description: "Understanding of business value drivers and risks of inaction",
            subComponents: [
                {
                    name: "Positive Outcomes Identification",
                    description: "Clear articulation of benefits, value, and positive impacts of solving the problem",
                    keywords: ["benefit", "value", "improve", "increase", "save", "gain", "advantage", "opportunity", "ROI", "revenue"],
                    scoringCriteria: {
                        excellent: "Multiple positive outcomes clearly identified with quantified benefits and business impact",
                        good: "Positive outcomes are clearly stated with some quantification or business context",
                        fair: "Some positive outcomes mentioned but lack detail or business impact clarity",
                        poor: "Positive outcomes are vague, generic, or not explicitly discussed"
                    }
                },
                {
                    name: "Negative Consequences Understanding",
                    description: "Recognition of risks, costs, and negative impacts of not solving the problem",
                    keywords: ["risk", "cost", "lose", "failure", "consequence", "impact", "problem", "delay", "miss", "behind"],
                    scoringCriteria: {
                        excellent: "Clear understanding of risks and costs of inaction with specific examples and quantified impact",
                        good: "Negative consequences are identified with reasonable detail and business context",
                        fair: "Some risks mentioned but lack specificity or urgency",
                        poor: "Negative consequences are not discussed or only vaguely referenced"
                    }
                }
            ]
        },
        {
            name: "Required Capabilities",
            description: "Understanding of what capabilities or features are needed to bridge the gap",
            subComponents: [
                {
                    name: "Capability Identification",
                    description: "How well the required capabilities to solve the problem are identified",
                    keywords: ["capability", "feature", "function", "need", "require", "must", "should", "solution", "tool"],
                    scoringCriteria: {
                        excellent: "Required capabilities are clearly identified and mapped to specific business needs",
                        good: "Capabilities are well-defined with clear connection to business requirements",
                        fair: "Some capabilities mentioned but connection to needs could be clearer",
                        poor: "Required capabilities are vague, generic, or not clearly connected to business needs"
                    }
                },
                {
                    name: "Capability Prioritization",
                    description: "Understanding of which capabilities are most critical or urgent",
                    keywords: ["priority", "critical", "important", "urgent", "first", "key", "essential", "must-have"],
                    scoringCriteria: {
                        excellent: "Clear prioritization of capabilities with reasoning tied to business impact",
                        good: "Some prioritization evident with reasonable business justification",
                        fair: "Limited prioritization or unclear reasoning for priorities",
                        poor: "No clear prioritization or all capabilities treated as equally important"
                    }
                }
            ]
        },
        {
            name: "Success Metrics",
            description: "Definition of how success will be measured and recognized",
            subComponents: [
                {
                    name: "Metric Definition",
                    description: "How clearly success metrics and KPIs are defined",
                    keywords: ["metric", "measure", "KPI", "success", "track", "monitor", "benchmark", "target", "goal"],
                    scoringCriteria: {
                        excellent: "Specific, measurable metrics clearly defined with baseline and target values",
                        good: "Success metrics are identified with reasonable specificity",
                        fair: "Some metrics mentioned but lack clarity or measurability",
                        poor: "Success metrics are vague, generic, or not explicitly defined"
                    }
                },
                {
                    name: "Measurement Timeline",
                    description: "Understanding of when and how often success will be measured",
                    keywords: ["timeline", "when", "frequency", "review", "check", "evaluate", "quarterly", "monthly"],
                    scoringCriteria: {
                        excellent: "Clear timeline for measurement with specific review periods and milestones",
                        good: "Measurement timeline is reasonably defined",
                        fair: "Some timeline mentioned but lacks specificity",
                        poor: "No clear timeline for measuring success"
                    }
                }
            ]
        },
        {
            name: "Miro Positioning",
            description: "How well Miro's capabilities are positioned against the identified needs",
            subComponents: [
                {
                    name: "Solution Alignment",
                    description: "How well Miro's features are connected to specific customer needs",
                    keywords: ["Miro", "platform", "solution", "address", "solve", "help", "enable", "support"],
                    scoringCriteria: {
                        excellent: "Miro's capabilities are clearly mapped to specific customer needs with concrete examples",
                        good: "Good connection between Miro features and customer requirements",
                        fair: "Some connection made but could be more specific or compelling",
                        poor: "Weak or generic positioning of Miro against customer needs"
                    }
                },
                {
                    name: "Differentiation",
                    description: "How well Miro is differentiated from alternatives or current solutions",
                    keywords: ["different", "unique", "better", "advantage", "versus", "compared", "alternative", "competitive"],
                    scoringCriteria: {
                        excellent: "Clear differentiation with specific advantages over alternatives",
                        good: "Some differentiation presented with reasonable justification",
                        fair: "Limited differentiation or generic competitive positioning",
                        poor: "No clear differentiation or positioning against alternatives"
                    }
                }
            ]
        }
    ]
};

// Great Demo Framework Definition
export const GREAT_DEMO_FRAMEWORK: FrameworkDefinition = {
    name: "Great Demo",
    description: "A framework for discovery-focused demos that align with customer business outcomes",
    components: [
        {
            name: "Critical Business Issues",
            description: "Understanding of top-level business challenges and objectives",
            subComponents: [
                {
                    name: "Business Challenge Identification",
                    description: "How clearly the individual's top-level business challenge is documented",
                    keywords: ["challenge", "issue", "problem", "objective", "goal", "quarterly", "annual", "project", "initiative"],
                    scoringCriteria: {
                        excellent: "Critical business issue clearly identified with specific quarterly/annual goal context",
                        good: "Business challenge is well-articulated with clear business context",
                        fair: "Some business challenge mentioned but lacks specificity or context",
                        poor: "Business challenge is vague, assumed, or not clearly identified"
                    }
                },
                {
                    name: "Risk Assessment",
                    description: "Understanding of what puts the business objective at risk",
                    keywords: ["risk", "threat", "obstacle", "barrier", "block", "prevent", "jeopardize", "impact"],
                    scoringCriteria: {
                        excellent: "Clear understanding of specific risks threatening the business objective",
                        good: "Risks are identified with reasonable detail and business impact",
                        fair: "Some risks mentioned but lack clarity or urgency",
                        poor: "Risks are not discussed or only vaguely referenced"
                    }
                }
            ]
        },
        {
            name: "Problems / Reasons",
            description: "Understanding of why the challenge is a problem and current state difficulties",
            subComponents: [
                {
                    name: "Problem Root Cause",
                    description: "Understanding of why the business challenge is difficult to achieve",
                    keywords: ["because", "due to", "caused by", "reason", "why", "difficult", "hard", "challenging"],
                    scoringCriteria: {
                        excellent: "Root causes clearly identified with specific examples and business impact",
                        good: "Problems are well-explained with clear reasoning and some examples",
                        fair: "Some problem explanation but lacks depth or specific examples",
                        poor: "Problem reasons are vague, surface-level, or not clearly explained"
                    }
                },
                {
                    name: "Current Process Understanding",
                    description: "How well current methods and processes are understood",
                    keywords: ["currently", "today", "now", "process", "method", "approach", "way", "how", "workflow"],
                    scoringCriteria: {
                        excellent: "Current processes thoroughly understood with specific workflow details",
                        good: "Current approach is clearly documented with reasonable detail",
                        fair: "Some understanding of current process but lacks detail",
                        poor: "Current process is not well understood or documented"
                    }
                }
            ]
        },
        {
            name: "Specific Capabilities",
            description: "Understanding of required capabilities from the prospect's perspective",
            subComponents: [
                {
                    name: "Capability Requirements",
                    description: "How clearly the needed capabilities are stated from prospect's viewpoint",
                    keywords: ["need", "require", "must", "should", "capability", "feature", "function", "able to"],
                    scoringCriteria: {
                        excellent: "Required capabilities clearly stated in prospect's language with specific use cases",
                        good: "Capabilities are well-defined from prospect's perspective",
                        fair: "Some capability requirements mentioned but lack prospect's perspective",
                        poor: "Capability requirements are vendor-focused or not clearly from prospect's viewpoint"
                    }
                },
                {
                    name: "Use Case Alignment",
                    description: "How well capabilities align with specific prospect use cases",
                    keywords: ["use case", "scenario", "example", "situation", "when", "context", "apply"],
                    scoringCriteria: {
                        excellent: "Capabilities clearly tied to specific prospect use cases and scenarios",
                        good: "Good alignment between capabilities and prospect use cases",
                        fair: "Some use case alignment but could be more specific",
                        poor: "Weak connection between capabilities and actual prospect use cases"
                    }
                }
            ]
        },
        {
            name: "Delta (Value Quantification)",
            description: "Quantified value of changing from current state using prospect's numbers",
            subComponents: [
                {
                    name: "Current State Metrics",
                    description: "Understanding of prospect's current performance numbers",
                    keywords: ["currently", "today", "now", "baseline", "metric", "number", "cost", "time", "performance"],
                    scoringCriteria: {
                        excellent: "Current state metrics clearly documented using prospect's actual numbers",
                        good: "Some current state metrics identified with reasonable specificity",
                        fair: "Limited current state metrics or lack of prospect's actual numbers",
                        poor: "Current state metrics are generic, assumed, or not quantified"
                    }
                },
                {
                    name: "Value Calculation",
                    description: "Calculation of value improvement using prospect's numbers",
                    keywords: ["save", "improve", "increase", "reduce", "gain", "value", "ROI", "benefit", "delta"],
                    scoringCriteria: {
                        excellent: "Clear value calculation using prospect's numbers with specific improvement amounts",
                        good: "Value is reasonably quantified with some prospect-specific numbers",
                        fair: "Some value quantification but lacks prospect-specific calculations",
                        poor: "Value is generic, assumed, or not calculated using prospect data"
                    }
                }
            ]
        },
        {
            name: "Critical Date / Value Realization Event",
            description: "Understanding of timeline and when value needs to be realized",
            subComponents: [
                {
                    name: "Timeline Definition",
                    description: "How clearly the critical date is defined and understood",
                    keywords: ["date", "deadline", "timeline", "when", "by", "need", "must", "required", "target"],
                    scoringCriteria: {
                        excellent: "Critical date clearly defined with specific timeline and business reasoning",
                        good: "Timeline is reasonably clear with some business context",
                        fair: "Some timeline mentioned but lacks specificity or business justification",
                        poor: "Timeline is vague, flexible, or not clearly defined"
                    }
                },
                {
                    name: "Value Realization Understanding",
                    description: "Understanding of why the timeline is critical and what triggers value",
                    keywords: ["realize", "achieve", "deliver", "impact", "benefit", "why", "important", "critical"],
                    scoringCriteria: {
                        excellent: "Clear understanding of value realization triggers and why timing is critical",
                        good: "Good understanding of value realization with reasonable justification",
                        fair: "Some understanding but lacks clarity on value realization timing",
                        poor: "Value realization timing is unclear or not well understood"
                    }
                }
            ]
        }
    ]
};

// Demo2Win Framework Definition
export const DEMO2WIN_FRAMEWORK: FrameworkDefinition = {
    name: "Demo2Win",
    description:
      "A framework for outcome-driven, scenario-based demos using Tell–Show–Tell, strong openings, interactivity with control, credible proof, and a clear close with a Mutual Action Plan (MAP).",
    components: [
      {
        name: "Opening & Context Setting",
        description:
          "Set a concise, persona-relevant purpose, align scope and time, and confirm expectations up front.",
        subComponents: [
          {
            name: "Opening Hook",
            description:
              "Crisp, audience-specific 'why now' that earns attention in under 60 seconds.",
            keywords: [
              "today",
              "purpose",
              "why",
              "outcome",
              "goal",
              "focus",
              "context",
              "hook",
              "time-box"
            ],
            scoringCriteria: {
              excellent:
                "Opens in ≤60s with a persona-relevant business outcome; immediately frames why it matters now.",
              good:
                "Clear opening tied to outcomes, minor personalization gaps or slightly long.",
              fair:
                "Generic opening; focuses on agenda more than outcomes; limited relevance.",
              poor:
                "No clear opening or relevance; jumps into features without context."
            }
          },
          {
            name: "Relevance & Scope Confirmation",
            description:
              "Align agenda to outcomes; make in-scope/out-of-scope explicit and confirm agreement.",
            keywords: [
              "agenda",
              "scope",
              "in scope",
              "out of scope",
              "time",
              "expectations",
              "confirm"
            ],
            scoringCriteria: {
              excellent:
                "Agenda maps to stakeholder outcomes; in/out-of-scope and timing confirmed with the room.",
              good:
                "Agenda and timing shared; general agreement obtained; small gaps in outcome linkage.",
              fair:
                "Agenda present but generic; limited confirmation; weak time framing.",
              poor:
                "No agenda or scope alignment; expectations unaddressed."
            }
          }
        ]
      },
      {
        name: "Persona Recap & Success Criteria",
        description:
          "Reconfirm roles, objectives, metrics, and decision criteria in the customer's language.",
        subComponents: [
          {
            name: "Stakeholder Objectives Recap",
            description:
              "Restate who is in the room, their goals, and what a good outcome looks like for each.",
            keywords: [
              "you said",
              "objective",
              "role",
              "persona",
              "KPI",
              "goal",
              "priority"
            ],
            scoringCriteria: {
              excellent:
                "Role-based recap with specific KPIs and needs; attendees confirm accuracy.",
              good:
                "Covers most roles and goals with some metrics; general confirmation obtained.",
              fair:
                "Partial recap; vague metrics or missing personas; weak validation.",
              poor:
                "No recap; assumes needs; no validation from attendees."
            }
          },
          {
            name: "Success Criteria & Ownership",
            description:
              "Clarify decision/acceptance criteria, owners, and how 'good' will be measured.",
            keywords: [
              "success criteria",
              "acceptance",
              "decision",
              "measure",
              "owner",
              "metric"
            ],
            scoringCriteria: {
              excellent:
                "Specific criteria, measurement, and named owners confirmed live.",
              good:
                "Criteria discussed with some measurement and ownership; minor gaps.",
              fair:
                "General criteria implied; unclear ownership and measurement.",
              poor:
                "No explicit criteria or ownership identified."
            }
          }
        ]
      },
      {
        name: "Scenario Storyline & Selection",
        description:
          "Organize the demo around the fewest, highest-impact scenarios with clear signposting.",
        subComponents: [
          {
            name: "Scenario Prioritization",
            description:
              "Select 1–3 scenarios that directly tie to the decision criteria and personas.",
            keywords: [
              "scenario",
              "use case",
              "priority",
              "impact",
              "decision",
              "fit"
            ],
            scoringCriteria: {
              excellent:
                "1–3 high-impact scenarios chosen that map directly to success criteria.",
              good:
                "Relevant scenarios chosen; minor prioritization or fit gaps.",
              fair:
                "Too many or loosely relevant scenarios; value diluted.",
              poor:
                "Random feature tour with no scenario structure."
            }
          },
          {
            name: "Transitions & Signposting",
            description:
              "Make it obvious where you are, why it matters, and what’s next.",
            keywords: ["transition", "now we’ll", "next", "so far", "recap"],
            scoringCriteria: {
              excellent:
                "Clear transitions that link sections to value and maintain flow.",
              good:
                "Most transitions clear; occasional abrupt switches.",
              fair:
                "Infrequent or vague signposting; some audience confusion.",
              poor:
                "Jarring jumps; storyline hard to follow."
            }
          }
        ]
      },
      {
        name: "Tell–Show–Tell Execution",
        description:
          "Apply Tell–Show–Tell to every segment: set context, show the shortest winning path, and reinforce business value.",
        subComponents: [
          {
            name: "First Tell (Setup)",
            description:
              "State what you’ll show and why it matters, in customer terms, before touching the UI.",
            keywords: ["tell", "setup", "why", "context", "outcome"],
            scoringCriteria: {
              excellent:
                "≤30s statement of What + Why in customer language; ties to criteria/persona.",
              good:
                "Clear setup in business terms; minor verbosity or missing tie-back.",
              fair:
                "States ‘what’ but weak ‘why’; drifts into feature labels.",
              poor:
                "No setup; jumps straight into UI."
            }
          },
          {
            name: "Show (Execution)",
            description:
              "Demonstrate the shortest, cleanest click-path aligned to the scenario; avoid tangents.",
            keywords: [
              "demo",
              "workflow",
              "click-path",
              "bookmark",
              "no tangents",
              "data"
            ],
            scoringCriteria: {
              excellent:
                "Tight, pre-staged path with relevant data; zero dead-ends or tangents.",
              good:
                "Clean flow with minimal detours; generally aligned.",
              fair:
                "Some backtracking or tangents; partial alignment.",
              poor:
                "Exploratory clicking; confusing navigation; feature dump."
            }
          },
          {
            name: "Final Tell (Value Reinforcement)",
            description:
              "Translate what they saw into measurable business impact and bridge to the next step.",
            keywords: ["value", "impact", "metric", "risk removed", "so you can"],
            scoringCriteria: {
              excellent:
                "Concise value recap in customer terms with a metric or risk removed; smooth bridge.",
              good:
                "Clear benefits stated; light quantification or generic metric.",
              fair:
                "General benefit language; weak tie-back to criteria.",
              poor:
                "No summary; abruptly moves on."
            }
          }
        ]
      },
      {
        name: "Interactivity & Control",
        description:
          "Engage the audience with targeted check-ins while maintaining control using a parking-lot and redirects.",
        subComponents: [
          {
            name: "Check-ins & Pauses",
            description:
              "Use short, targeted questions to confirm fit and understanding without derailing flow.",
            keywords: [
              "check-in",
              "questions",
              "confirm",
              "does this match",
              "pause"
            ],
            scoringCriteria: {
              excellent:
                "Planned, concise check-ins surface insight and keep momentum.",
              good:
                "Periodic check-ins help alignment; minor timing issues.",
              fair:
                "Few or vague check-ins; limited insight gained.",
              poor:
                "Monologue; no interaction or feedback loops."
            }
          },
          {
            name: "Handling Interruptions",
            description:
              "Acknowledge–clarify–redirect; capture items in a parking lot and protect the agenda.",
            keywords: [
              "parking lot",
              "redirect",
              "acknowledge",
              "clarify",
              "control"
            ],
            scoringCriteria: {
              excellent:
                "Interruptions handled gracefully; flow protected; rapport maintained.",
              good:
                "Most interruptions contained; minor drift.",
              fair:
                "Frequent derailments; control inconsistent.",
              poor:
                "Loses control; defensive or meandering responses."
            }
          }
        ]
      },
      {
        name: "Proof & Risk Handling",
        description:
          "Provide relevant, credible proof and proactively address top risks to de-risk the decision.",
        subComponents: [
          {
            name: "Relevant Proof Points",
            description:
              "Use customer-like references, quantified outcomes, or realistic evidence matched to the scenario.",
            keywords: [
              "reference",
              "case study",
              "metric",
              "evidence",
              "validation",
              "before/after"
            ],
            scoringCriteria: {
              excellent:
                "Industry/size/use-case matched proof with quantified outcomes integrated at the right moments.",
              good:
                "Relevant proof points with some metrics; timing mostly good.",
              fair:
                "Generic references; weak tie to scenario/persona.",
              poor:
                "No proof or irrelevant anecdotes."
            }
          },
          {
            name: "Objection & Risk Management",
            description:
              "Preempt or respond crisply to concerns on security, scale, integration, roadmap, etc.",
            keywords: [
              "objection",
              "risk",
              "security",
              "scale",
              "integration",
              "roadmap",
              "compliance"
            ],
            scoringCriteria: {
              excellent:
                "Top risks preempted with clear answers or next steps; increases buyer confidence.",
              good:
                "Objections handled when raised; responses mostly complete.",
              fair:
                "Partial or vague responses; follow-ups unclear.",
              poor:
                "Deflects, overpromises, or ignores risks."
            }
          }
        ]
      },
      {
        name: "Environment Readiness & Professionalism",
        description:
          "Deliver with a polished environment, readable UI, and backup plan to inspire confidence.",
        subComponents: [
          {
            name: "Environment Setup",
            description:
              "Realistic data, correct user role, readable zoom, pre-staged tabs, and clean visuals.",
            keywords: [
              "demo data",
              "role",
              "readability",
              "zoom",
              "bookmark",
              "prep"
            ],
            scoringCriteria: {
              excellent:
                "Zero distractions; production-like data and role; visuals are easy to follow.",
              good:
                "Minor cosmetic issues; no functional blockers.",
              fair:
                "Several frictions (visibility/data); impacts clarity at times.",
              poor:
                "Breaks, dead-ends, messy data, or unreadable UI."
            }
          },
          {
            name: "Technical Hygiene",
            description:
              "Stable A/V, notifications off, bandwidth verified, and a ready fallback.",
            keywords: [
              "audio",
              "video",
              "notifications",
              "bandwidth",
              "backup",
              "recording"
            ],
            scoringCriteria: {
              excellent:
                "Flawless delivery with tested backup environment/deck.",
              good:
                "Minor hiccups handled gracefully.",
              fair:
                "Noticeable issues or recovery delays.",
              poor:
                "Repeated failures; no backup plan."
            }
          }
        ]
      },
      {
        name: "Closing & Mutual Action Plan (MAP)",
        description:
          "Recap outcomes, make a clear ask, and secure next steps with owners and dates.",
        subComponents: [
          {
            name: "Decision/Action Ask",
            description:
              "Explicitly ask for the decision or step the session was designed to enable.",
            keywords: [
              "ask",
              "decision",
              "approve",
              "recommend",
              "move forward",
              "greenlight"
            ],
            scoringCriteria: {
              excellent:
                "Crisp ask linked to criteria; specific owner/date requested.",
              good:
                "Clear next step proposed; ownership implied or partially set.",
              fair:
                "Vague or passive close; unclear accountability.",
              poor:
                "No ask; ends without direction."
            }
          },
          {
            name: "Mutual Action Plan",
            description:
              "Capture owners, dates, milestones, and risks live with the customer.",
            keywords: [
              "mutual action plan",
              "timeline",
              "owner",
              "milestone",
              "dependency",
              "risk"
            ],
            scoringCriteria: {
              excellent:
                "MAP documented live with owners/dates/dependencies; shared immediately after.",
              good:
                "Next steps summarized with most owners/dates; MAP drafted for follow-up.",
              fair:
                "Informal next steps; ownership and dates unclear.",
              poor:
                "No concrete next steps or commitments."
            }
          }
        ]
      },
      {
        name: "Demo Crimes Avoidance",
        description:
          "Avoid common mistakes that erode clarity, credibility, and momentum.",
        subComponents: [
          {
            name: "No Feature Dumping",
            description:
              "Resist unplanned tours and deep configuration tangents that don’t serve the scenario.",
            keywords: ["feature dump", "tangent", "tour", "configuration"],
            scoringCriteria: {
              excellent:
                "Every click supports the scenario; advanced items deferred appropriately.",
              good:
                "One brief tangent contained; flow largely intact.",
              fair:
                "Multiple tangents reduce clarity and time control.",
              poor:
                "Extended tours with little connection to outcomes."
            }
          },
          {
            name: "Language & Navigation Discipline",
            description:
              "Use plain business language and clean navigation with minimal backtracking.",
            keywords: ["jargon", "acronym", "backtrack", "clarity", "plain"],
            scoringCriteria: {
              excellent:
                "Plain language; smooth navigation; no backtracking.",
              good:
                "Mostly plain with minor slips or brief backtracking.",
              fair:
                "Frequent jargon or navigation hiccups; occasional confusion.",
              poor:
                "Heavy jargon, frequent backtracking, audience confusion."
            }
          }
        ]
      }
    ]
  };
  


// Helper Functions
export async function getFrameworkDefinition(frameworkName: string): Promise<FrameworkDefinition> {
    if (!validateFrameworkName(frameworkName)) {
        throw new Error(`Unknown framework: ${frameworkName}`);
    }
    
    return await loadFrameworkFromFile(frameworkName);
}

export function getFrameworkDefinitionSync(frameworkName: string): FrameworkDefinition {
    if (!validateFrameworkName(frameworkName)) {
        throw new Error(`Unknown framework: ${frameworkName}`);
    }
    
    const cached = frameworkCache.get(frameworkName);
    if (cached) {
        return cached;
    }
    
    throw new Error(`Framework definition for ${frameworkName} not loaded. Call getFrameworkDefinition() first.`);
}

async function loadFrameworkFromFile(frameworkName: string): Promise<FrameworkDefinition> {
    const cacheKey = frameworkName;
    
    // Check cache first
    if (frameworkCache.has(cacheKey)) {
        console.log(`📚 Using cached framework definition for ${frameworkName}`);
        return frameworkCache.get(cacheKey)!;
    }

    try {
        const frameworksPath = path.join(__dirname, 'frameworks');
        const definitionPath = path.join(frameworksPath, frameworkName, 'definition.json');
        
        console.log(`📖 Loading framework definition from: ${definitionPath}`);
        const definitionContent = await fs.readFile(definitionPath, 'utf8');
        const definition: FrameworkDefinition = JSON.parse(definitionContent);
        
        // Cache the definition
        frameworkCache.set(cacheKey, definition);
        console.log(`✅ Loaded framework definition for ${definition.displayName || definition.name}`);
        
        return definition;
    } catch (error) {
        console.error(`❌ Failed to load framework definition for ${frameworkName}:`, error);
        
        // Fallback to a minimal definition to prevent complete failure
        const fallbackDefinition: FrameworkDefinition = {
            name: frameworkName,
            displayName: frameworkName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: `Framework definition for ${frameworkName} (fallback)`,
            components: []
        };
        
        return fallbackDefinition;
    }
}

export function validateFrameworkName(frameworkName: string): boolean {
    return ["command_of_the_message", "great_demo", "demo2win", "miro_value_selling"].includes(frameworkName);
}

export const VALID_FRAMEWORKS = ["command_of_the_message", "great_demo", "demo2win", "miro_value_selling"] as const;
export type ValidFramework = typeof VALID_FRAMEWORKS[number];