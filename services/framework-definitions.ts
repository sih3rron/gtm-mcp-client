import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// services/framework-definitions.ts

// Core Framework Interfaces
export interface FrameworkComponent {
    name: string;
    description: string;
    subComponents: SubComponent[];
}

export interface SubComponent {
    name: string;
    description: string;
    keywords: string[];
    scoringCriteria: {
        excellent: string; // 9-10
        good: string;      // 7-8
        fair: string;      // 5-6
        poor: string;      // 1-4
    };
}

export interface FrameworkDefinition {
    name: string;
    description: string;
    components: FrameworkComponent[];
}

// Analysis Result Interfaces
export interface SubComponentScore {
    name: string;
    score: number; // 1-10
    evidence: string[];
    qualitativeAssessment: string;
    improvementSuggestions: string[];
}

export interface ComponentAnalysis {
    name: string;
    overallScore: number; // Average of sub-component scores
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
    overallScore: number; // Average of all component scores
    components: ComponentAnalysis[];
    executiveSummary: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    };
    followUpCallPlanning: FollowUpCallPlanning; // 🆕 NEW FIELD
}

export interface AggregateAnalysis {
    totalCalls: number;
    frameworks: string[];
    overallScore: number;
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

// Helper Functions
export function getFrameworkDefinition(frameworkName: string): FrameworkDefinition {
    switch (frameworkName) {
        case "command_of_the_message":
            return COMMAND_OF_THE_MESSAGE_FRAMEWORK;
        case "great_demo":
            return GREAT_DEMO_FRAMEWORK;
        default:
            throw new Error(`Unknown framework: ${frameworkName}`);
    }
}

export function validateFrameworkName(frameworkName: string): boolean {
    return ["command_of_the_message", "great_demo"].includes(frameworkName);
}

export const VALID_FRAMEWORKS = ["command_of_the_message", "great_demo"] as const;
export type ValidFramework = typeof VALID_FRAMEWORKS[number];