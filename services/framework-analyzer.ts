// services/framework-analyzer.ts - HYBRID VERSION
// Combines resource loading with your existing sophisticated features
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

import {
    FrameworkDefinition,
    CallAnalysis,
    AggregateAnalysis,
    ComponentAnalysis,
    SubComponentScore,
    getFrameworkDefinition,
    validateFrameworkName,
    ValidFramework,
    FollowUpCallPlanning

} from './framework-definitions.js';

dotenv.config({ path: '.env.local' });

// Enhanced Framework Resource Interface (NEW)
interface FrameworkResources {
    methodology?: string;
    definition?: any;
    scoringExamples?: string;
    callExamples?: string;
    planningChecklist?: string;
}

// Validation helpers (PRESERVED from your version)
export class FrameworkAnalysisValidator {
    static validateCallIds(callIds: string[]): void {
        if (!Array.isArray(callIds) || callIds.length === 0) {
            throw new Error("callIds must be a non-empty array");
        }
        
        callIds.forEach(id => {
            if (typeof id !== 'string' || id.trim().length === 0) {
                throw new Error("Each call ID must be a non-empty string");
            }
        });
    }

    static validateFrameworks(frameworks: string[]): void {
        const validFrameworks = ["command_of_the_message", "great_demo"];
        if (!Array.isArray(frameworks) || frameworks.length === 0) {
            throw new Error("frameworks must be a non-empty array");
        }

        frameworks.forEach(framework => {
            if (!validFrameworks.includes(framework)) {
                throw new Error(`Invalid framework: ${framework}. Must be one of: ${validFrameworks.join(", ")}`);
            }
        });
    }

    static validateScore(score: number, fieldName: string): void {
        if (typeof score !== 'number' || score < 1 || score > 10) {
            throw new Error(`${fieldName} must be a number between 1 and 10`);
        }
    }
}

export class FrameworkAnalyzer {
    private anthropicClient: any;
    private gongService: any;
    private frameworksPath: string;
    private resourceCache: Map<string, FrameworkResources> = new Map(); // NEW

    constructor(anthropicClient: any, gongService: any, frameworksPath?: string) {
        this.anthropicClient = anthropicClient;
        this.gongService = gongService;
        this.frameworksPath = frameworksPath || path.join(__dirname, 'frameworks'); // NEW
    }

    // NEW: Load framework resources from files
    private async loadFrameworkResources(frameworkName: ValidFramework): Promise<FrameworkResources> {
        const cacheKey = frameworkName;
        
        // Check cache first
        if (this.resourceCache.has(cacheKey)) {
            console.log(`📚 Using cached resources for ${frameworkName}`);
            return this.resourceCache.get(cacheKey)!;
        }

        console.log(`📖 Loading framework resources for ${frameworkName}`);
        const resources: FrameworkResources = {};
        const frameworkDir = path.join(this.frameworksPath, frameworkName);

        try {
            // Load methodology.md
            try {
                const methodologyPath = path.join(frameworkDir, 'methodology.md');
                resources.methodology = await fs.readFile(methodologyPath, 'utf8');
                console.log(`✅ Loaded methodology for ${frameworkName} (${resources.methodology.length} chars)`);
            } catch (error) {
                console.warn(`⚠️  Could not load methodology for ${frameworkName}:`, error);
            }

            // Load definition.json
            try {
                const definitionPath = path.join(frameworkDir, 'definition.json');
                const definitionContent = await fs.readFile(definitionPath, 'utf8');
                resources.definition = JSON.parse(definitionContent);
                console.log(`✅ Loaded definition for ${frameworkName}`);
            } catch (error) {
                console.warn(`⚠️  Could not load definition for ${frameworkName}:`, error);
            }

            // Load scoring_examples.md
            try {
                const scoringPath = path.join(frameworkDir, 'scoring_examples.md');
                resources.scoringExamples = await fs.readFile(scoringPath, 'utf8');
                console.log(`✅ Loaded scoring examples for ${frameworkName} (${resources.scoringExamples.length} chars)`);
            } catch (error) {
                console.warn(`⚠️  Could not load scoring examples for ${frameworkName}:`, error);
            }

            // Load call_examples.md
            try {
                const callExamplesPath = path.join(frameworkDir, 'call_examples.md');
                resources.callExamples = await fs.readFile(callExamplesPath, 'utf8');
                console.log(`✅ Loaded call examples for ${frameworkName} (${resources.callExamples.length} chars)`);
            } catch (error) {
                console.warn(`⚠️  Could not load call examples for ${frameworkName}:`, error);
            }

            // Load planning_checklist.md
            try {
                const checklistPath = path.join(frameworkDir, 'planning_checklist.md');
                resources.planningChecklist = await fs.readFile(checklistPath, 'utf8');
                console.log(`✅ Loaded planning checklist for ${frameworkName} (${resources.planningChecklist.length} chars)`);
            } catch (error) {
                console.warn(`⚠️  Could not load planning checklist for ${frameworkName}:`, error);
            }

            // Cache the resources
            this.resourceCache.set(cacheKey, resources);
            console.log(`📚 Cached framework resources for ${frameworkName}`);

        } catch (error) {
            console.error(`❌ Error loading framework resources for ${frameworkName}:`, error);
        }

        return resources;
    }

    public async analyzeCallsFramework(args: {
        callIds: string[];
        frameworks: string[];
        includeParticipantRoles?: boolean;
        includeCallSequence?: boolean;
    }): Promise<AggregateAnalysis> {
        console.log('🔍 Starting framework analysis for calls:', args.callIds);
        
        const { callIds, frameworks, includeParticipantRoles = true, includeCallSequence = false } = args;
    
        // Validate inputs
        FrameworkAnalysisValidator.validateCallIds(callIds);
        FrameworkAnalysisValidator.validateFrameworks(frameworks);
    
        console.log(`📊 Analyzing ${callIds.length} calls against ${frameworks.length} frameworks`);
    
        // Fetch call details for all calls
        const callAnalyses: CallAnalysis[] = [];
        
        for (const callId of callIds) {
            try {
                console.log(`📞 Processing call: ${callId}`);
                
                // UPDATED: Get BOTH call details AND transcript data
                const [callDetails, transcriptData] = await Promise.all([
                    this.gongService.getGongCallDetails({ callId }),
                    this.gongService.getGongCallTranscript(callId)
                ]);
                
                console.log(`✅ Got call details for ${callId}:`, callDetails.callId);
                console.log(`✅ Got transcript data for ${callId}:`, {
                    hasTranscript: transcriptData.hasTranscript,
                    transcriptLength: transcriptData.transcript?.length || 0
                });
    
                // UPDATED: Merge call details with transcript data
                const enrichedCallDetails = {
                    ...callDetails,
                    transcript: transcriptData.transcript || [],
                    hasTranscript: transcriptData.hasTranscript || false,
                    // Generate transcript summary if transcript is available
                    transcriptSummary: transcriptData.hasTranscript && transcriptData.transcript?.length > 0 
                        ? this.gongService.generateTranscriptSummary(transcriptData.transcript)
                        : null
                };
    
                console.log(`🔍 Framework Analyzer received enriched callDetails:`, JSON.stringify({
                    callId: enrichedCallDetails.callId,
                    title: enrichedCallDetails.title,
                    date: enrichedCallDetails.date,
                    duration: enrichedCallDetails.duration,
                    participants: enrichedCallDetails.participants,
                    hasTranscript: enrichedCallDetails.hasTranscript,
                    transcriptLength: enrichedCallDetails.transcript?.length || 0,
                    transcriptSummary: enrichedCallDetails.transcriptSummary ? {
                        totalSpeakers: enrichedCallDetails.transcriptSummary.totalSpeakers,
                        keyTopics: enrichedCallDetails.transcriptSummary.keyTopics,
                        totalDuration: enrichedCallDetails.transcriptSummary.totalDuration
                    } : null
                }, null, 2));
                    
                // Analyze against each requested framework
                for (const framework of frameworks) {
                    try {
                        console.log(`🧠 Analyzing call ${callId} against ${framework} framework`);
                        const analysis = await this.analyzeCallAgainstFramework(
                            enrichedCallDetails,  // Now includes transcript data
                            framework as ValidFramework, 
                            includeParticipantRoles
                        );
                        callAnalyses.push(analysis);
                        console.log(`✅ Completed ${framework} analysis for call ${callId}, score: ${analysis.overallScore}`);
                    } catch (frameworkError) {
                        console.error(`❌ Error analyzing call ${callId} against ${framework} framework:`, this.formatError(frameworkError));
                        // Create a fallback analysis for this specific framework
                        const fallbackAnalysis = this.createErrorAnalysis(callId, enrichedCallDetails, framework, frameworkError);
                        callAnalyses.push(fallbackAnalysis);
                    }
                }
            } catch (callError) {
                console.error(`❌ Error fetching call data for ${callId}:`, this.formatError(callError));
                
                // Try to get basic call details even if analysis fails
                try {
                    console.log(`⚠️ Attempting to get basic call details for ${callId}...`);
                    const basicCallDetails = await this.gongService.getGongCallDetails({ callId });
                    
                    // Analyze with basic details
                    for (const framework of frameworks) {
                        const fallbackAnalysis = this.createErrorAnalysis(callId, basicCallDetails, framework, callError);
                        callAnalyses.push(fallbackAnalysis);
                    }
                } catch (basicCallError) {
                    console.error(`❌ Failed to get even basic call details for ${callId}:`, this.formatError(basicCallError));
                    // Create a minimal error analysis
                    for (const framework of frameworks) {
                        const minimalAnalysis = this.createErrorAnalysis(callId, null, framework, callError);
                        callAnalyses.push(minimalAnalysis);
                    }
                }
            }
        }
    
        console.log(`📈 Generating aggregate analysis for ${callAnalyses.length} call analyses`);
        
        // Generate aggregate analysis
        const result = this.generateAggregateAnalysis(callAnalyses, frameworks);
        
        console.log(`✅ Framework analysis complete. Overall score: ${result.overallScore}`);
        return result;
    }

    // ENHANCED: Now loads and uses framework resources
    private async analyzeCallAgainstFramework(
        callDetails: any, 
        framework: ValidFramework, 
        includeParticipantRoles: boolean
    ): Promise<CallAnalysis> {
        // Load both hardcoded definition AND resource files
        const frameworkDef = getFrameworkDefinition(framework);
        const frameworkResources = await this.loadFrameworkResources(framework); // NEW

        // Add logging for Duration and CallDate (PRESERVED)
        console.log('🔍 Framework Analysis - CallDate and Duration Debug:');
        console.log('  - callDetails.date:', callDetails.date);
        console.log('  - callDetails.duration:', callDetails.duration);
        console.log('  - callDetails keys:', Object.keys(callDetails));
        console.log('  - callDetails type:', typeof callDetails);

        // Prepare enhanced analysis context (ENHANCED)
        const analysisContext = {
            callDetails,
            framework: frameworkDef,
            resources: frameworkResources, // NEW
            includeParticipantRoles
        };

        console.log(`🔬 Performing enhanced analysis for ${frameworkDef.name} with loaded resources`);

        // Use Anthropic to analyze the call content with enhanced context
        const analysis = await this.performFrameworkAnalysis(analysisContext);
        
        return {
            callId: callDetails.callId,
            callTitle: callDetails.title,
            callUrl: callDetails.callUrl || `https://app.gong.io/call?id=${callDetails.callId}`,
            callDate: callDetails.date,
            participants: this.extractParticipants(callDetails),
            duration: callDetails.duration,
            framework: frameworkDef.name,
            overallScore: analysis.overallScore ?? 0,
            components: analysis.components ?? [],
            executiveSummary: analysis.executiveSummary ?? { strengths: [], weaknesses: [], recommendations: [] },
            followUpCallPlanning: analysis.followUpCallPlanning ?? this.createDefaultFollowUpPlan(callDetails, frameworkDef.name)
        };
    }

    private createDefaultFollowUpPlan(callDetails: any, frameworkName: string): FollowUpCallPlanning {
        return {
            overallStrategy: `Follow-up call needed to complete ${frameworkName} framework analysis`,
            deeperInquiryAreas: [],
            unansweredQuestions: [],
            discoveryGaps: [],
            stakeholderMapping: {
                currentParticipants: this.extractParticipants(callDetails),
                missingStakeholders: [],
                recommendedInvites: [],
                evidenceOfNeed: []
            },
            nextCallObjectives: [{
                objective: "Complete framework analysis with more detailed discovery",
                rationale: "Initial call analysis indicates additional discovery needed",
                customerEvidence: []
            }],
            opportunityIndicators: []
        };
    }

    // ENHANCED: Now uses framework resources in analysis
    private async performFrameworkAnalysis(context: any): Promise<Partial<CallAnalysis>> {
        const { callDetails, framework, resources, includeParticipantRoles } = context;
        
        console.log(`🧠 Building enhanced analysis prompt for ${framework.name}`);
        // ENHANCED: Use new method that includes resources
        const analysisPrompt = resources ? 
            this.buildEnhancedAnalysisPrompt(framework, resources, callDetails, includeParticipantRoles) :
            this.buildAnalysisPrompt(framework, callDetails, includeParticipantRoles); // Fallback to original
        
        let responseText: string = '';
        
        try {
            console.log('📡 Calling Anthropic for framework analysis...');
            const modelId = process.env.ANTHROPIC_MODEL;
            console.log('🔍 Using model:', modelId);
            const response = await this.anthropicClient.messages.create({
                model: modelId,
                max_tokens: 3000, // Increased for richer analysis with resources
                messages: [{
                    role: 'user',
                    content: analysisPrompt
                }],
                system: `You are an expert sales methodology analyst with deep expertise in sales frameworks. ${resources ? 'You have access to comprehensive methodology guides and practical examples.' : ''}

                CRITICAL: Your response MUST be valid JSON only, no other text. Structure your response exactly as specified in the prompt.

                Focus on:
                1. Evidence-based scoring (look for specific examples in the call content when available)
                2. Actionable improvement suggestions${resources ? ' based on methodology best practices' : ''}
                3. Clear qualitative assessments
                4. Realistic scoring (most calls will score 4-7, perfect 10s are rare)
                5. Handle missing transcript gracefully (use "No transcript available" as evidence when needed)
                
                IMPORTANT: If no transcript is available:
                - Base analysis on call metadata (title, duration, participants)
                - Use framework methodology and best practices as guidance
                - Use "No transcript available" as evidence when specific examples cannot be cited
                - Focus on framework application rather than specific call content
                - Provide realistic scores based on available information
                
                Be thorough but realistic. Look for actual evidence in the call content to support your scores when available.${resources ? ' Use the provided framework methodology and examples to guide your analysis and ensure recommendations align with proven best practices.' : ''}`
            });

            console.log('✅ Received Anthropic response, parsing JSON...');
            
            // Handle different response formats from Anthropic (PRESERVED)
            if (Array.isArray(response.content)) {
                responseText = response.content[0].text;
            } else if (typeof response.content === 'string') {
                responseText = response.content;
            } else {
                throw new Error('Unexpected response format from Anthropic');
            }

            // Extract and clean JSON response using jsonrepair (PRESERVED)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in response');
            }
            
            const cleanedJson = this.repairJsonResponse(jsonMatch[0]);
            const analysisResult = JSON.parse(cleanedJson);
            console.log('✅ Successfully parsed enhanced analysis result');
            
            // Validate and enhance citations (PRESERVED)
            const citationValidation = this.validateCitations(analysisResult);
            console.log(`🔍 Citation validation:`, {
                hasCitations: citationValidation.hasCitations,
                citationCount: citationValidation.citationCount,
                missingCitations: citationValidation.missingCitations.length
            });
            
            // Enhance analysis with citations if needed (PRESERVED)
            const enhancedAnalysis = this.enhanceAnalysisWithCitations(analysisResult, callDetails);
            
            return enhancedAnalysis;

        } catch (error) {
            console.error('❌ Framework analysis failed:', error);
            
            // Log detailed error information for debugging (PRESERVED)
            if (responseText) {
                console.error('🔍 Raw response text length:', responseText.length);
                console.error('🔍 First 500 chars of response:', responseText.substring(0, 500));
                console.error('🔍 Last 500 chars of response:', responseText.substring(responseText.length - 500));
                
                // Try to find where JSON might have been cut off
                const openBraces = (responseText.match(/\{/g) || []).length;
                const closeBraces = (responseText.match(/\}/g) || []).length;
                console.error(`🔍 JSON structure: ${openBraces} opening braces, ${closeBraces} closing braces`);
                
                if (openBraces !== closeBraces) {
                    const lastOpenBrace = responseText.lastIndexOf('{');
                    const lastCloseBrace = responseText.lastIndexOf('}');
                    console.error('🔍 JSON appears to be malformed or truncated');
                    const start = Math.max(0, lastOpenBrace - 100);
                    const end = Math.min(responseText.length, lastCloseBrace + 100);
                    console.error('🔍 Problematic JSON section:', responseText.substring(start, end));
                }
            }
            
            // Log detailed error information for debugging (PRESERVED)
            if (error instanceof Error && 'response' in error) {
                const axiosError = error as any;
                console.error('🔍 Detailed Anthropic API Error:');
                console.error('  Status:', axiosError.response?.status);
                console.error('  Status Text:', axiosError.response?.statusText);
                console.error('  Headers:', axiosError.response?.headers);
                console.error('  Data:', JSON.stringify(axiosError.response?.data, null, 2));
                console.error('  Request URL:', axiosError.config?.url);
                console.error('  Request Method:', axiosError.config?.method);
                console.error('  Request Headers:', axiosError.config?.headers);
                console.error('  Request Data:', JSON.stringify(axiosError.config?.data, null, 2));
            } else {
                console.error('🔍 Error details:', error);
            }
            
            // Return a fallback analysis structure if LLM call fails (PRESERVED)
            const fallbackAnalysis = this.createFallbackAnalysis(framework, callDetails);
            console.log('⚠️ Using fallback analysis due to error');
            return fallbackAnalysis;
        }
    }

    // NEW: Enhanced prompt building with framework resources
    private buildEnhancedAnalysisPrompt(
        framework: FrameworkDefinition, 
        resources: FrameworkResources, 
        callDetails: any, 
        includeParticipantRoles: boolean
    ): string {
        const participantInfo = includeParticipantRoles 
            ? `\nParticipants: ${this.extractParticipants(callDetails).join(", ")}`
            : "";

        // Include transcript data if available for better analysis and citations (ENHANCED)
        const transcriptInfo = callDetails.hasTranscript && callDetails.transcript && callDetails.transcript.length > 0
            ? `\n\nCALL TRANSCRIPT (for detailed analysis and citations):
${this.enhanceTranscriptForCitations(callDetails.transcript)}

TRANSCRIPT SUMMARY:
- Total Speakers: ${callDetails.transcriptSummary?.totalSpeakers || 0}
- Key Topics Discussed: ${callDetails.transcriptSummary?.keyTopics?.join(", ") || "None identified"}
- Conversation Duration: ${callDetails.transcriptSummary?.totalDuration || 0} seconds
- Speaker Breakdown: ${JSON.stringify(callDetails.transcriptSummary?.speakerSummary || {}, null, 2)}`
            : `\n\nTRANSCRIPT: No transcript available for this call.

IMPORTANT: Since no transcript is available, base your analysis on:
- Call metadata (title, duration, participants)
- Framework methodology and best practices
- General sales call patterns and expectations
- Use "No transcript available" as evidence when specific examples cannot be cited
- Focus on framework application rather than specific call content`;

        // Build comprehensive framework context from resources (NEW)
        let frameworkContext = `\n\n# ${framework.name} Framework Analysis\n\n`;
        
        // Add methodology if available
        if (resources.methodology) {
            frameworkContext += `## Framework Methodology\n${resources.methodology.substring(0, 4000)}\n\n`; // Truncate for tokens
        }

        // Add scoring examples if available
        if (resources.scoringExamples) {
            frameworkContext += `## Scoring Examples and Guidelines\n${resources.scoringExamples.substring(0, 2000)}\n\n`; // Truncate for tokens
        }

        // Add call examples if available (truncated)
        if (resources.callExamples) {
            frameworkContext += `## Call Analysis Examples\n${resources.callExamples.substring(0, 1500)}\n\n`; // Truncate for tokens
        }

        // Add structured framework definition
        frameworkContext += `## Framework Structure\n${JSON.stringify(framework, null, 2)}\n\n`;

        return `
Analyze this sales call against the ${framework.name} framework using the comprehensive methodology and examples provided.

CALL INFORMATION:
- Title: ${callDetails.title}
- Date: ${callDetails.date}
- Duration: ${callDetails.duration}${participantInfo}${transcriptInfo}

${frameworkContext}

## Analysis Requirements

Provide a detailed analysis in the following JSON format:

{
  "overallScore": <number 1-10>,
  "components": [...],
  "executiveSummary": {
    "strengths": ["<strength observed in the call>", "..."],
    "weaknesses": ["<area for improvement>", "..."],
    "recommendations": ["<specific recommendation based on framework>", "..."]
  },
  "followUpCallPlanning": {
    "overallStrategy": "<high-level approach for next call based on analysis>",
    "deeperInquiryAreas": [
      {
        "area": "<area needing deeper exploration>",
        "reason": "<why this needs deeper inquiry based on call analysis>",
        "suggestedQuestions": ["<specific discovery questions to ask>", "..."],
        "priority": "high|medium|low",
        "supportingEvidence": [
          {
            "speaker": "<Customer Name (Title)>",
            "timestamp": "<MM:SS if available>",
            "quote": "<exact customer words from transcript>",
            "context": "<why this quote supports the need for deeper inquiry>"
          }
        ]
      }
    ],
    "unansweredQuestions": [
      {
        "question": "<question that wasn't fully answered>",
        "context": "<context about why this question matters>",
        "frameworkComponent": "<which framework component this relates to>",
        "originalCustomerResponse": {
          "speaker": "<Customer Name>",
          "timestamp": "<MM:SS>",
          "quote": "<what customer actually said>",
          "context": "<why this response was incomplete>"
        },
        "whyIncomplete": "<explanation of why the response needs follow-up>"
      }
    ],
    "discoveryGaps": [
      {
        "gapArea": "<area where discovery was insufficient>",
        "impact": "<business impact of this gap>",
        "discoveryApproach": "<suggested approach to fill the gap>",
        "indicatorQuotes": [
          {
            "speaker": "<Customer Name>",
            "timestamp": "<MM:SS>",
            "quote": "<customer quote indicating this gap>",
            "context": "<why this quote shows the gap exists>"
          }
        ]
      }
    ],
    "stakeholderMapping": {
      "currentParticipants": ["<list of current participants>"],
      "missingStakeholders": ["<stakeholders that should be involved>"],
      "recommendedInvites": ["<specific people/roles to invite>"],
      "evidenceOfNeed": [
        {
          "speaker": "<Customer Name>",
          "timestamp": "<MM:SS>",
          "quote": "<customer quote showing need for additional stakeholders>",
          "context": "<why this indicates missing stakeholders>"
        }
      ]
    },
    "nextCallObjectives": [
      {
        "objective": "<specific objective for next call>",
        "rationale": "<why this objective is important>",
        "customerEvidence": [
          {
            "speaker": "<Customer Name>",
            "timestamp": "<MM:SS>",
            "quote": "<customer quote supporting this objective>",
            "context": "<why this quote justifies the objective>"
          }
        ]
      }
    ],
    "opportunityIndicators": [
      {
        "indicator": "<buying signal or opportunity identified>",
        "customerQuote": {
          "speaker": "<Customer Name>",
          "timestamp": "<MM:SS>",
          "quote": "<customer quote showing the opportunity>",
          "context": "<why this indicates an opportunity>"
        },
        "followUpAction": "<specific action to take based on this indicator>",
        "potentialValue": "<assessment of opportunity value - High/Medium/Low>"
      }
    ]
  }
}

## Scoring Guidelines
- Use the methodology and scoring examples to guide your evaluation
- Look for specific evidence in the transcript to support scores
- Provide framework-aligned recommendations using the methodology guidance
- Be realistic with scoring (most calls score 4-7, excellence is rare)
- Connect analysis to business outcomes and framework objectives

## Follow-up Planning Guidelines (CRITICAL):

### Citation Requirements:
- Every follow-up recommendation MUST include supporting customer citations
- Use EXACT customer quotes from the transcript - no paraphrasing
- Include speaker name and timestamp when available
- Provide context explaining why each quote supports the recommendation
- If no customer evidence exists for a recommendation, do not include it

### Deeper Inquiry Areas:
Look for customer statements indicating:
- Incomplete information ("I'm not sure exactly...", "It depends...")
- Vague quantification ("a lot", "significant", "way too much")
- Emotional language indicating pain ("frustrated", "bottleneck", "struggle")
- Unfinished thoughts or deflected questions
- Areas with low framework component scores (below 7)

### Unanswered Questions:
Identify where:
- Customer deflected or avoided direct questions
- Rep asked but customer gave incomplete responses
- Important topics were mentioned but not explored
- Customer said "we need to discuss that internally"

### Discovery Gaps:
Find evidence of missing information through:
- Customer mentioning stakeholders not present
- Technical or process details that were skipped
- References to "other considerations" without explanation
- Mentions of requirements or constraints not fully explored

### Opportunity Indicators:
Look for strong buying signals such as:
- Budget discussions ("we have budget allocated")
- Timeline urgency ("need this by Q3", "can't wait much longer") 
- Pain point intensity ("this is killing us", "major problem")
- Solution enthusiasm ("that sounds perfect", "exactly what we need")
- Decision-maker language ("we're ready to move forward")

## Quality Standards for Follow-up Planning:
- Every section must have customer evidence when recommendations are made
- Prioritize recommendations with stronger customer evidence
- Focus on actionable next steps that directly address gaps identified in the call
- Ensure suggested questions are specific and framework-aligned
- Link opportunity indicators to potential business outcomes

Analyze thoroughly using the framework methodology and respond with ONLY the JSON object.
`;
    }

    // PRESERVED: Your original buildAnalysisPrompt method as fallback
    private buildAnalysisPrompt(framework: FrameworkDefinition, callDetails: any, includeParticipantRoles: boolean): string {
        const participantInfo = includeParticipantRoles 
            ? `\nParticipants: ${this.extractParticipants(callDetails).join(", ")}`
            : "";

        // Include transcript data if available for better analysis and citations
        const transcriptInfo = callDetails.hasTranscript && callDetails.transcript && callDetails.transcript.length > 0
            ? `\n\nCALL TRANSCRIPT (for detailed analysis and citations):
${this.enhanceTranscriptForCitations(callDetails.transcript)}

TRANSCRIPT SUMMARY:
- Total Speakers: ${callDetails.transcriptSummary?.totalSpeakers || 0}
- Key Topics Discussed: ${callDetails.transcriptSummary?.keyTopics?.join(", ") || "None identified"}
- Conversation Duration: ${callDetails.transcriptSummary?.totalDuration || 0} seconds
- Speaker Breakdown: ${JSON.stringify(callDetails.transcriptSummary?.speakerSummary || {}, null, 2)}`
            : `\n\nTRANSCRIPT: No transcript available for this call.

IMPORTANT: Since no transcript is available, base your analysis on:
- Call metadata (title, duration, participants)
- Framework methodology and best practices
- General sales call patterns and expectations
- Use "No transcript available" as evidence when specific examples cannot be cited
- Focus on framework application rather than specific call content`;

        return `
Analyze this sales call against the ${framework.name} framework.

CALL INFORMATION:
- Title: ${callDetails.title}
- Date: ${callDetails.date}
- Duration: ${callDetails.duration}${participantInfo}${transcriptInfo}

FRAMEWORK: ${framework.name}
${framework.description}

COMPONENTS TO ANALYZE:
${framework.components.map(comp => `
${comp.name}: ${comp.description}
Sub-components:
${comp.subComponents.map(sub => `- ${sub.name}: ${sub.description}`).join('\n')}
`).join('\n')}

Provide analysis in JSON format with components, scores (1-10), evidence from transcript, and recommendations.

Response format:
{
  "overallScore": <number>,
  "components": [...],
  "executiveSummary": {"strengths": [...], "weaknesses": [...], "recommendations": [...]}
}

Respond with ONLY the JSON object.
`;
    }

    // ALL YOUR PRESERVED METHODS FROM ORIGINAL (keeping all your sophisticated logic):

    private extractParticipants(callDetails: any): string[] {
        if (callDetails.participants && Array.isArray(callDetails.participants)) {
            return callDetails.participants.map((p: any) => p.name || p.email || p.toString());
        }
        return ["Unknown"];
    }

    private enhanceTranscriptForCitations(transcript: any[]): string {
        if (!transcript || transcript.length === 0) {
            return "No transcript available for this call.";
        }

        // Create a citation-friendly format with better indexing
        const enhancedTranscript = transcript.map((entry, index) => {
            const timestamp = entry.startTime ? `[${Math.round(entry.startTime / 60)}min]` : `[${index}]`;
            const speaker = entry.speaker || 'Unknown';
            const text = entry.text || '';
            const topic = entry.topic ? ` (Topic: ${entry.topic})` : '';
            const citationId = `[${speaker}, ${timestamp}]`;
            return `${citationId} "${text}"${topic}`;
        }).join('\n');

        return `CITATION-ENHANCED TRANSCRIPT:
${enhancedTranscript}

CITATION FORMAT: Use [Speaker Name, ~Xmin] for all references to this transcript.`;
    }

    private repairJsonResponse(jsonText: string): string {
        try {
            console.log(`🔍 Repairing JSON response (length: ${jsonText.length})`);
            
            // Use jsonrepair to fix malformed JSON
            const repaired = jsonrepair(jsonText);
            
            // Validate the repaired JSON is parseable
            const parsed = JSON.parse(repaired);
            
            // Validate the structure using Zod schema
            this.validateAnalysisStructure(parsed);
            
            console.log('✅ Successfully repaired and validated JSON response');
            return repaired;
        } catch (error) {
            console.warn('Failed to repair JSON response:', error);
            
            // Fallback: try to extract a valid JSON object by truncating
            try {
                const truncated = this.truncateToValidJson(jsonText);
                if (truncated) {
                    const parsed = JSON.parse(truncated);
                    this.validateAnalysisStructure(parsed);
                    console.log('✅ Successfully truncated and validated JSON');
                    return truncated;
                }
            } catch (truncateError) {
                console.warn('Failed to truncate JSON:', truncateError);
            }
            
            // Last resort: try to create a minimal valid JSON structure
            try {
                console.log('🔧 Creating minimal fallback JSON structure...');
                const fallbackJson = this.createMinimalFallbackJson();
                this.validateAnalysisStructure(fallbackJson);
                console.log('✅ Created minimal fallback JSON structure');
                return JSON.stringify(fallbackJson);
            } catch (fallbackError) {
                console.warn('Failed to create fallback JSON:', fallbackError);
            }
            
            // Absolute last resort: return original
            return jsonText;
        }
    }

    private validateAnalysisStructure(analysis: any): void {
        try {
            // Define a flexible schema for the analysis structure that allows 0 scores for error cases
            const AnalysisSchema = z.object({
                overallScore: z.number().min(0).max(10), // Allow 0 for error cases
                components: z.array(z.object({
                    name: z.string(),
                    overallScore: z.number().min(0).max(10), // Allow 0 for error cases
                    subComponents: z.array(z.object({
                        name: z.string(),
                        score: z.number().min(0).max(10), // Allow 0 for error cases
                        evidence: z.array(z.string()),
                        qualitativeAssessment: z.string(),
                        improvementSuggestions: z.array(z.string())
                    })),
                    keyFindings: z.array(z.string())
                })),
                executiveSummary: z.object({
                    strengths: z.array(z.string()),
                    weaknesses: z.array(z.string()),
                    recommendations: z.array(z.string())
                })
            });

            AnalysisSchema.parse(analysis);
            console.log('✅ Analysis structure validation passed');
        } catch (error) {
            console.warn('⚠️ Analysis structure validation failed:', error);
            throw error;
        }
    }

    private truncateToValidJson(jsonText: string): string | null {
        // Try to find the last complete JSON object
        let depth = 0;
        let lastValidEnd = -1;
        
        for (let i = 0; i < jsonText.length; i++) {
            const char = jsonText[i];
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    lastValidEnd = i;
                }
            }
        }
        
        if (lastValidEnd > -1) {
            return jsonText.substring(0, lastValidEnd + 1);
        }
        
        return null;
    }

    private createMinimalFallbackJson(): any {
        // Create a minimal valid JSON structure for when all else fails
        return {
            overallScore: 0,
            components: [
                {
                    name: "Analysis Error",
                    overallScore: 0,
                    subComponents: [
                        {
                            name: "Processing Error",
                            score: 0,
                            evidence: ["JSON parsing failed - unable to extract analysis"],
                            qualitativeAssessment: "Analysis could not be completed due to JSON parsing error",
                            improvementSuggestions: ["Check system logs", "Retry analysis", "Contact support if issue persists"]
                        }
                    ],
                    keyFindings: ["Analysis failed due to technical error"]
                }
            ],
            executiveSummary: {
                strengths: [],
                weaknesses: ["Analysis could not be completed due to technical error"],
                recommendations: ["Retry analysis", "Check system configuration", "Contact support if issue persists"]
            }
        };
    }

    private validateCitations(analysis: any): {
        hasCitations: boolean;
        citationCount: number;
        missingCitations: string[];
    } {
        let citationCount = 0;
        const missingCitations: string[] = [];

        if (analysis.components && Array.isArray(analysis.components)) {
            analysis.components.forEach((component: any) => {
                if (component.subComponents && Array.isArray(component.subComponents)) {
                    component.subComponents.forEach((subComponent: any) => {
                        if (subComponent.evidence && subComponent.evidence.length > 0) {
                            citationCount += subComponent.evidence.length;
                        } else {
                            missingCitations.push(`${component.name} - ${subComponent.name}`);
                        }
                    });
                }
                
                if (component.keyFindings) {
                    component.keyFindings.forEach((finding: string) => {
                        if (finding.includes('[') && finding.includes(']')) {
                            citationCount++;
                        }
                    });
                }
            });
        }

        if (analysis.executiveSummary) {
            const summaryFields = [
                ...(analysis.executiveSummary.strengths || []),
                ...(analysis.executiveSummary.weaknesses || []),
                ...(analysis.executiveSummary.recommendations || [])
            ];
            
            summaryFields.forEach((field: string) => {
                if (field.includes('[') && field.includes(']')) {
                    citationCount++;
                }
            });
        }

        return {
            hasCitations: citationCount > 0,
            citationCount,
            missingCitations
        };
    }

    private enhanceAnalysisWithCitations(analysis: Partial<CallAnalysis>, callDetails: any): Partial<CallAnalysis> {
        // If transcript is available but citations are missing, add a note
        if (callDetails.hasTranscript && analysis.components) {
            analysis.components.forEach(component => {
                if (component.subComponents) {
                    component.subComponents.forEach(subComponent => {
                        if (!subComponent.evidence || subComponent.evidence.length === 0) {
                            subComponent.evidence = ["[Analysis Note]: Transcript available but no specific evidence cited. Review transcript manually for this component."];
                        }
                    });
                }
            });
        }

        return analysis;
    }

    private createFallbackAnalysis(framework: FrameworkDefinition, callDetails: any): Partial<CallAnalysis> {
        // Create a basic analysis structure when LLM analysis fails
        const hasTranscript = callDetails?.hasTranscript && callDetails?.transcript && callDetails.transcript.length > 0;
        const hasBasicData = callDetails?.title && callDetails?.callId;
        
        let overallScore = 0; // Start with 0 for error cases
        let evidenceMessage = "Analysis unavailable due to processing error";
        let assessmentMessage = "Unable to analyze due to technical error. Manual review recommended.";
        let recommendationMessage = "Re-run analysis when system is stable";
        
        if (hasBasicData && !hasTranscript) {
            overallScore = 3; // Slightly higher if we have basic data but no transcript
            evidenceMessage = "No transcript available - analysis based on call metadata only";
            assessmentMessage = "Limited analysis possible without transcript. Review call metadata and consider transcript availability.";
            recommendationMessage = "Obtain transcript for more detailed analysis";
        } else if (hasBasicData && hasTranscript) {
            overallScore = 4; // Higher if we have both basic data and transcript
            evidenceMessage = "Analysis failed despite having transcript data";
            assessmentMessage = "Technical error occurred during analysis. Data was available but processing failed.";
            recommendationMessage = "Check system logs and retry analysis";
        }

        const components: ComponentAnalysis[] = framework.components.map(comp => ({
            name: comp.name,
            overallScore,
            subComponents: comp.subComponents.map(sub => ({
                name: sub.name,
                score: overallScore,
                evidence: [evidenceMessage],
                qualitativeAssessment: assessmentMessage,
                improvementSuggestions: [recommendationMessage, "Manual review recommended"]
            })),
            keyFindings: [`Analysis could not be completed: ${assessmentMessage}`]
        }));

        return {
            overallScore: hasBasicData ? 3 : 0, // Slightly higher if we have basic data
            components,
            executiveSummary: {
                strengths: hasBasicData ? ["Call metadata available"] : [],
                weaknesses: ["Analysis incomplete due to system error", hasTranscript ? "Technical error despite available data" : "No transcript available"],
                recommendations: ["Re-run analysis when system is available", "Manual review recommended"]
            },
            // 🆕 NEW: Add fallback follow-up planning
            followUpCallPlanning: {
                overallStrategy: "Manual follow-up planning required due to analysis error",
                deeperInquiryAreas: [{
                    area: "Complete Framework Analysis",
                    reason: "System error prevented automated analysis",
                    suggestedQuestions: ["Review call manually using framework methodology"],
                    priority: 'high' as const,
                    supportingEvidence: []
                }],
                unansweredQuestions: [],
                discoveryGaps: [{
                    gapArea: "Complete Call Analysis",
                    impact: "Cannot provide specific recommendations without successful analysis",
                    discoveryApproach: "Manual review of call content against framework criteria",
                    indicatorQuotes: []
                }],
                stakeholderMapping: {
                    currentParticipants: callDetails ? this.extractParticipants(callDetails) : [],
                    missingStakeholders: [],
                    recommendedInvites: [],
                    evidenceOfNeed: []
                },
                nextCallObjectives: [{
                    objective: "Manual call review and planning",
                    rationale: "Automated analysis failed",
                    customerEvidence: []
                }],
                opportunityIndicators: []
            }
        };
    }

    private formatError(error: any): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    private createErrorAnalysis(callId: string, callDetails: any, framework: string, error: any): CallAnalysis {
        const errorMessage = this.formatError(error);
        const frameworkDef = getFrameworkDefinition(framework as ValidFramework);
        
        // Determine if we have any useful data
        const hasBasicData = callDetails?.title && callDetails?.callId;
        const hasTranscript = callDetails?.hasTranscript && callDetails?.transcript && callDetails.transcript.length > 0;
        
        let overallScore = 0;
        let evidenceMessage = `Analysis failed: ${errorMessage}`;
        let assessmentMessage = `Unable to analyze due to error: ${errorMessage}`;
        let recommendationMessage = "Fix the error and re-run analysis";
        
        if (hasBasicData && !hasTranscript) {
            overallScore = 2; // Slightly higher if we have basic data but no transcript
            evidenceMessage = `Analysis failed: ${errorMessage}. No transcript available.`;
            assessmentMessage = `Error occurred during analysis. Call metadata available but no transcript. Error: ${errorMessage}`;
            recommendationMessage = "Fix the error and obtain transcript for better analysis";
        } else if (hasBasicData && hasTranscript) {
            overallScore = 3; // Higher if we have both basic data and transcript
            evidenceMessage = `Analysis failed despite having data: ${errorMessage}`;
            assessmentMessage = `Technical error occurred during analysis despite having transcript data. Error: ${errorMessage}`;
            recommendationMessage = "Check system configuration and retry analysis";
        }
        
        return {
            callId,
            callTitle: callDetails?.title || "Unknown Call",
            callUrl: callDetails?.callUrl || `https://app.gong.io/call?id=${callId}`,
            callDate: callDetails?.date || "Unknown",
            participants: callDetails ? this.extractParticipants(callDetails) : ["Unknown"],
            duration: callDetails?.duration || "Unknown",
            framework: frameworkDef.name,
            overallScore: 0,
            components: frameworkDef.components.map(comp => ({
                name: comp.name,
                overallScore: 0,
                subComponents: comp.subComponents.map(sub => ({
                    name: sub.name,
                    score: 0,
                    evidence: [`Analysis failed: ${errorMessage}`],
                    qualitativeAssessment: `Unable to analyze due to error: ${errorMessage}`,
                    improvementSuggestions: ["Fix the error and re-run analysis", "Check call data availability"]
                })),
                keyFindings: [`Analysis failed: ${errorMessage}`]
            })),
            executiveSummary: {
                strengths: [],
                weaknesses: [`Analysis failed: ${errorMessage}`],
                recommendations: ["Fix the error and re-run analysis", "Check system configuration"]
            },
            // 🆕 NEW: Add error follow-up planning
            followUpCallPlanning: {
                overallStrategy: "Error recovery and manual analysis required",
                deeperInquiryAreas: [],
                unansweredQuestions: [],
                discoveryGaps: [{
                    gapArea: "Complete Analysis",
                    impact: "Cannot provide recommendations due to system error",
                    discoveryApproach: "Fix system error and retry analysis",
                    indicatorQuotes: []
                }],
                stakeholderMapping: {
                    currentParticipants: callDetails ? this.extractParticipants(callDetails) : [],
                    missingStakeholders: [],
                    recommendedInvites: [],
                    evidenceOfNeed: []
                },
                nextCallObjectives: [{
                    objective: "Resolve analysis error and retry",
                    rationale: "System error prevented analysis completion",
                    customerEvidence: []
                }],
                opportunityIndicators: []
            }
        };
    }

    private generateAggregateAnalysis(callAnalyses: CallAnalysis[], frameworks: string[]): AggregateAnalysis {
        console.log('📊 Generating aggregate insights...');
        
        const totalCalls = callAnalyses.length;
        if (totalCalls === 0) {
            throw new Error("No call analyses available for aggregation");
        }

        const overallScore = callAnalyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / totalCalls;

        // Aggregate insights across all calls
        const allStrengths = callAnalyses.flatMap(analysis => analysis.executiveSummary.strengths);
        const allWeaknesses = callAnalyses.flatMap(analysis => analysis.executiveSummary.weaknesses);

        // Find common patterns
        const strengthCounts = this.countOccurrences(allStrengths);
        const weaknessCounts = this.countOccurrences(allWeaknesses);

        const aggregateInsights: any = {
            strengthsAcrossCalls: this.getTopItems(strengthCounts, 5),
            weaknessesAcrossCalls: this.getTopItems(weaknessCounts, 5),
            improvementOpportunities: this.generateImprovementOpportunities(callAnalyses)
        };

        // Framework comparison if multiple frameworks analyzed
        if (frameworks.length > 1) {
            const commandScores = callAnalyses
                .filter(a => a.framework === "Command of the Message")
                .map(a => a.overallScore);
            const demoScores = callAnalyses
                .filter(a => a.framework === "Great Demo")
                .map(a => a.overallScore);

            aggregateInsights.frameworkComparison = {
                commandOfMessage: commandScores.length > 0 ? 
                    commandScores.reduce((a, b) => a + b, 0) / commandScores.length : undefined,
                greatDemo: demoScores.length > 0 ?
                    demoScores.reduce((a, b) => a + b, 0) / demoScores.length : undefined,
                insights: this.generateFrameworkComparisonInsights(commandScores, demoScores)
            };
        }

        console.log('✅ Aggregate analysis complete');

        return {
            totalCalls: totalCalls,
            frameworks,
            overallScore,
            callAnalyses,
            aggregateInsights,
            recommendations: this.generateAggregateRecommendations(callAnalyses, aggregateInsights)
        };
    }

    private countOccurrences(items: string[]): { [key: string]: number } {
        return items.reduce((acc, item) => {
            acc[item] = (acc[item] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });
    }

    private getTopItems(counts: { [key: string]: number }, limit: number): string[] {
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([item]) => item);
    }

    private generateImprovementOpportunities(callAnalyses: CallAnalysis[]): string[] {
        // Analyze common patterns across weak areas
        const commonWeakAreas = callAnalyses
            .flatMap(analysis => 
                analysis.components.flatMap(comp => 
                    comp.subComponents
                        .filter(sub => sub.score <= 6)
                        .map(sub => sub.name)
                )
            );

        const weakAreaCounts = this.countOccurrences(commonWeakAreas);
        const topWeakAreas = this.getTopItems(weakAreaCounts, 3);

        return topWeakAreas.map(area => 
            `Focus on improving ${area} - identified as weak area in ${weakAreaCounts[area]} out of ${callAnalyses.length} analyses`
        );
    }

    private generateFrameworkComparisonInsights(commandScores: number[], demoScores: number[]): string[] {
        const insights: string[] = [];
        
        if (commandScores.length > 0 && demoScores.length > 0) {
            const avgCommand = commandScores.reduce((a, b) => a + b, 0) / commandScores.length;
            const avgDemo = demoScores.reduce((a, b) => a + b, 0) / demoScores.length;
            
            if (Math.abs(avgCommand - avgDemo) > 1) {
                if (avgCommand > avgDemo) {
                    insights.push("Command of the Message framework shows stronger performance overall");
                } else {
                    insights.push("Great Demo framework shows stronger performance overall");
                }
            } else {
                insights.push("Both frameworks show similar performance levels");
            }
            
            // Add score distribution insights
            const commandVariance = this.calculateVariance(commandScores);
            const demoVariance = this.calculateVariance(demoScores);
            
            if (commandVariance < demoVariance) {
                insights.push("Command of the Message shows more consistent performance");
            } else if (demoVariance < commandVariance) {
                insights.push("Great Demo shows more consistent performance");
            }
        }
        
        return insights;
    }

    private calculateVariance(scores: number[]): number {
        if (scores.length === 0) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
        return variance;
    }

    private generateAggregateRecommendations(callAnalyses: CallAnalysis[], aggregateInsights: any): {
        immediate: string[];
        strategic: string[];
        coaching: string[];
    } {
        const lowestScoringCall = callAnalyses.reduce((lowest, current) => 
            current.overallScore < lowest.overallScore ? current : lowest
        );

        const highestScoringCall = callAnalyses.reduce((highest, current) => 
            current.overallScore > highest.overallScore ? current : highest
        );

        const averageScore = callAnalyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / callAnalyses.length;

        const immediate: string[] = [];
        const strategic: string[] = [];
        const coaching: string[] = [];

        // Immediate recommendations based on lowest performing areas
        if (lowestScoringCall.overallScore < 5) {
            immediate.push(`Review ${lowestScoringCall.callTitle} (Score: ${lowestScoringCall.overallScore}) for immediate improvement opportunities`);
        }

        // Strategic recommendations based on patterns
        if (averageScore < 6) {
            strategic.push("Consider implementing systematic framework training across the team");
        }

        if (aggregateInsights.weaknessesAcrossCalls.length > 0) {
            strategic.push(`Address common weakness patterns: ${aggregateInsights.weaknessesAcrossCalls.slice(0, 2).join(", ")}`);
        }

        // Coaching recommendations
        if (highestScoringCall.overallScore > 7) {
            coaching.push(`Use ${highestScoringCall.callTitle} (Score: ${highestScoringCall.overallScore}) as a coaching example for best practices`);
        }

        coaching.push("Schedule individual coaching sessions focusing on framework application");

        return {
            immediate,
            strategic,
            coaching
        };
    }
}

export const safeFrameworkAnalysis = async (analyzer: FrameworkAnalyzer, args: any): Promise<AggregateAnalysis> => {
    try {
        console.log('🔍 Starting safe framework analysis...');
        FrameworkAnalysisValidator.validateCallIds(args.callIds);
        FrameworkAnalysisValidator.validateFrameworks(args.frameworks);
        
        return await analyzer.analyzeCallsFramework(args);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ Safe framework analysis failed:', errorMessage);
        
        // Create a minimal error response that matches AggregateAnalysis interface
        const fallbackResponse: AggregateAnalysis = {
            totalCalls: args.callIds?.length || 0,
            frameworks: args.frameworks || [],
            overallScore: 0,
            callAnalyses: [],
            aggregateInsights: {
                strengthsAcrossCalls: [],
                weaknessesAcrossCalls: [`Analysis failed: ${errorMessage}`],
                improvementOpportunities: ['Fix analysis error and retry'],
            },
            recommendations: {
                immediate: ['Check system logs for analysis errors'],
                strategic: ['Review framework analysis configuration'],
                coaching: ['Manual call review recommended until issue resolved']
            }
        };
        
        return fallbackResponse;
    }
};