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

} from './framework-definitions';
import { PromptManager } from './prompt-manager';

dotenv.config({ path: '.env.local' });

// Enhanced Framework Resource Interface (NEW)
export interface FrameworkResources {
    methodology?: string;
    definition?: any;
    scoringExamples?: string;
    callExamples?: string;
    planningChecklist?: string;
}

export interface CustomerCitation {
    speaker: string;
    timestamp?: string;
    quote: string;
    context?: string;
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
        const validFrameworks = ["command_of_the_message", "great_demo", "demo2win", "miro_value_selling"];
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
    private resourceCache: Map<string, FrameworkResources> = new Map(); 
    private promptManager: PromptManager;

    constructor(anthropicClient: any, gongService: any, frameworksPath?: string) {
        this.anthropicClient = anthropicClient;
        this.gongService = gongService;
        this.frameworksPath = frameworksPath || path.join(__dirname, 'frameworks'); 
        this.promptManager = new PromptManager();
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

    private async analyzeCallAgainstFramework(
        callDetails: any,
        framework: ValidFramework,
        includeParticipantRoles: boolean
    ): Promise<CallAnalysis> {
        // UPDATED: Now load definition from file (async)
        const frameworkDef = await getFrameworkDefinition(framework); // ADD await
        const frameworkResources = await this.loadFrameworkResources(framework);
    
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
            resources: frameworkResources,
            includeParticipantRoles
        };
    
        console.log(`🔬 Performing enhanced analysis for ${frameworkDef.displayName || frameworkDef.name} with loaded resources`);
    
        // Use Anthropic to analyze the call content with enhanced context
        const analysis = await this.performFrameworkAnalysis(analysisContext);

        this.logCitationValidation(analysis, callDetails.callId);
    
        return {
            callId: callDetails.callId,
            callTitle: callDetails.title,
            callUrl: callDetails.callUrl || `https://app.gong.io/call?id=${callDetails.callId}`,
            callDate: callDetails.date,
            participants: this.extractParticipants(callDetails),
            duration: callDetails.duration,
            framework: frameworkDef.displayName || frameworkDef.name, // Use displayName if available
            overallScore: analysis.overallScore ?? 0,
            analysisStatus: 'completed',
            components: analysis.components ?? [],
            executiveSummary: analysis.executiveSummary ?? { strengths: [], weaknesses: [], recommendations: [] },
            followUpCallPlanning: analysis.followUpCallPlanning ?? this.createDefaultFollowUpPlan(callDetails, frameworkDef.displayName || frameworkDef.name)
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

    private async performFrameworkAnalysis(context: any): Promise<Partial<CallAnalysis>> {
        const { callDetails, framework, resources, includeParticipantRoles } = context;

        console.log(`🧠 Building enhanced analysis prompt for ${framework.name}`);
        
        // Use templates for prompt building
        const analysisPrompt = resources ?
            await this.buildEnhancedAnalysisPrompt(framework, resources, callDetails, includeParticipantRoles) :
            await this.buildAnalysisPrompt(framework, callDetails, includeParticipantRoles);

        const systemPrompt = await this.buildSystemPrompt(resources, callDetails);

        let responseText: string = '';

        try {
            console.log('📡 Calling Anthropic for framework analysis...');
            const modelId = process.env.ANTHROPIC_MODEL;
            console.log('🔍 Using model:', modelId);
            
            const response = await this.anthropicClient.messages.create({
                model: modelId,
                max_tokens: 4000,
                messages: [{
                    role: 'user',
                    content: analysisPrompt
                }],
                system: systemPrompt
            });

            console.log('✅ Received Anthropic response, parsing JSON...');

            // Handle different response formats from Anthropic
            if (Array.isArray(response.content)) {
                responseText = response.content[0].text;
            } else if (typeof response.content === 'string') {
                responseText = response.content;
            } else {
                throw new Error('Unexpected response format from Anthropic');
            }

            // Extract and clean JSON response using jsonrepair
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in response');
            }

            const cleanedJson = this.repairJsonResponse(jsonMatch[0]);
            const analysisResult = JSON.parse(cleanedJson);
            console.log('✅ Successfully parsed enhanced analysis result');

            // Validate and enhance citations
            const citationValidation = this.validateCitations(analysisResult);
            console.log(`🔍 Citation validation:`, {
                hasCitations: citationValidation.hasCitations,
                citationCount: citationValidation.citationCount,
                missingCitations: citationValidation.missingCitations.length
            });

            // Enhance analysis with citations if needed
            const enhancedAnalysis = this.enhanceAnalysisWithCitations(analysisResult, callDetails);
            console.log('✅ Enhanced analysis with citations');

            return enhancedAnalysis;

        } catch (error) {
            console.error('❌ Error in framework analysis:', error);

            // Detailed error logging for debugging
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

            // Return a fallback analysis structure if LLM call fails
            const fallbackAnalysis = this.createFallbackAnalysis(framework, callDetails);
            console.log('⚠️ Using fallback analysis due to error');
            return fallbackAnalysis;
        }
    }

    private async buildSystemPrompt(resources: any, callDetails: any): Promise<string> {
        const context = this.promptManager.buildSystemPromptContext(resources, callDetails);
        return await this.promptManager.renderSystemPrompt('system-prompt', context);
    }

    private async buildEnhancedAnalysisPrompt(
        framework: FrameworkDefinition,
        resources: FrameworkResources,
        callDetails: any,
        includeParticipantRoles: boolean
    ): Promise<string> {
        const context = this.promptManager.buildEnhancedAnalysisContext(
            framework,
            resources,
            callDetails,
            includeParticipantRoles
        );

        return await this.promptManager.renderPrompt('enhanced-analysis', context);
    }

    // UPDATED: Basic prompt building with templates
    private async buildAnalysisPrompt(
        framework: FrameworkDefinition,
        callDetails: any,
        includeParticipantRoles: boolean
    ): Promise<string> {
        const context = this.promptManager.buildBasicAnalysisContext(
            framework,
            callDetails,
            includeParticipantRoles
        );

        return await this.promptManager.renderPrompt('basic-analysis', context);
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
    
        const enhancedTranscript = transcript.map((entry, index) => {
            const timestamp = entry.startTime 
                ? this.formatTimestamp(entry.startTime)
                : `0:${index.toString().padStart(2, '0')}`;
            
            const speaker = this.getSpeakerDisplayName(entry.speaker || 'Unknown');
            const text = entry.text || '';
            const topic = entry.topic ? ` (Topic: ${entry.topic})` : '';
            
            // Format for AI to use in creating CustomerCitation objects
            return `[${timestamp}] ${speaker}: "${text}"${topic}`;
        }).join('\n');
    
        return `TRANSCRIPT:
    ${enhancedTranscript}
    
    CITATION FORMAT - CustomerCitation Object Structure:
    When referencing the transcript, use CustomerCitation objects with this structure:
    {
      "speaker": "Speaker Name" (from transcript),
      "timestamp": "mm:ss" (from transcript),
      "quote": "Actual quote or paraphrased content",
      "context": "Why this matters for your analysis"
    }
    
    Examples:
    - speaker: Use "John", "Sarah Chen", or "Unknown Speaker"
    - timestamp: Use "5:23", "12:45", "0:30" format
    - quote: The actual statement from the call
    - context: Analytical explanation of significance
    
    Use the exact speaker names and timestamps from the transcript above.`;
    }

private validateTimestampFormat(timestamp: string | undefined): boolean {
    if (!timestamp) return true; // Optional field
    
    // Check if format is mm:ss
    const timestampPattern = /^\d{1,3}:\d{2}$/;
    return timestampPattern.test(timestamp);
}


private validateCustomerCitation(citation: any, context: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // Check if it's an object
    if (typeof citation !== 'object' || citation === null) {
        errors.push(`${context}: Expected CustomerCitation object, got ${typeof citation}`);
        return { isValid: false, errors };
    }
    
    // Validate required fields
    if (!citation.speaker || typeof citation.speaker !== 'string') {
        errors.push(`${context}: Missing or invalid 'speaker' field`);
    }
    
    if (!citation.quote || typeof citation.quote !== 'string') {
        errors.push(`${context}: Missing or invalid 'quote' field`);
    }
    
    // Validate timestamp format if present
    if (citation.timestamp && !this.validateTimestampFormat(citation.timestamp)) {
        errors.push(`${context}: Timestamp "${citation.timestamp}" must be in mm:ss format (e.g., "5:23")`);
    }
    
    // Check for invalid speaker formats
    if (citation.speaker) {
        if (citation.speaker.match(/^[Ss]peaker\s+\d+$/)) {
            errors.push(`${context}: Speaker should be a name, not "Speaker 1" format. Use "Unknown Speaker" if name unavailable.`);
        }
        if (citation.speaker.match(/^[Ss]peaker\s*\([^)]+\)$/)) {
            errors.push(`${context}: Speaker "${citation.speaker}" appears to be in ID format. Should be a readable name.`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

private validateCitationFormat(analysis: Partial<CallAnalysis>): {
    isCompliant: boolean;
    totalCitations: number;
    invalidCitations: Array<{location: string; error: string}>;
    warnings: string[];
} {
    const invalidCitations: Array<{location: string; error: string}> = [];
    const warnings: string[] = [];
    let totalCitations = 0;
    
    // Helper to validate array of CustomerCitation
    const validateCitationArray = (citations: any[], context: string) => {
        if (!Array.isArray(citations)) return;
        
        citations.forEach((citation, idx) => {
            totalCitations++;
            const validation = this.validateCustomerCitation(citation, `${context}[${idx}]`);
            if (!validation.isValid) {
                validation.errors.forEach(error => {
                    invalidCitations.push({ location: `${context}[${idx}]`, error });
                });
            }
        });
    };
    
    // Check all components
    if (analysis.components) {
        analysis.components.forEach(component => {
            if (component.subComponents) {
                component.subComponents.forEach(subComponent => {
                    // Evidence field - check if it's string[] or CustomerCitation[]
                    if (subComponent.evidence && Array.isArray(subComponent.evidence)) {
                        // If first element is string, it's old format (we'll handle this)
                        if (subComponent.evidence.length > 0 && typeof subComponent.evidence[0] === 'string') {
                            warnings.push(`${component.name} > ${subComponent.name}: evidence uses string[] instead of CustomerCitation[]`);
                        } else {
                            validateCitationArray(
                                subComponent.evidence,
                                `${component.name} > ${subComponent.name} > evidence`
                            );
                        }
                    }
                });
            }
        });
    }
    
    // Check follow-up planning - this uses CustomerCitation type extensively
    if (analysis.followUpCallPlanning) {
        const planning = analysis.followUpCallPlanning;
        
        // deeperInquiryAreas
        if (planning.deeperInquiryAreas) {
            planning.deeperInquiryAreas.forEach((area, idx) => {
                if (area.supportingEvidence) {
                    validateCitationArray(
                        area.supportingEvidence,
                        `Follow-up > deeperInquiryAreas[${idx}] > supportingEvidence`
                    );
                }
            });
        }
        
        // unansweredQuestions
        if (planning.unansweredQuestions) {
            planning.unansweredQuestions.forEach((question, idx) => {
                if (question.originalCustomerResponse) {
                    totalCitations++;
                    const validation = this.validateCustomerCitation(
                        question.originalCustomerResponse,
                        `Follow-up > unansweredQuestions[${idx}] > originalCustomerResponse`
                    );
                    if (!validation.isValid) {
                        validation.errors.forEach(error => {
                            invalidCitations.push({
                                location: `Follow-up > unansweredQuestions[${idx}]`,
                                error
                            });
                        });
                    }
                }
            });
        }
        
        // discoveryGaps
        if (planning.discoveryGaps) {
            planning.discoveryGaps.forEach((gap, idx) => {
                if (gap.indicatorQuotes) {
                    validateCitationArray(
                        gap.indicatorQuotes,
                        `Follow-up > discoveryGaps[${idx}] > indicatorQuotes`
                    );
                }
            });
        }
        
        // stakeholderMapping
        if (planning.stakeholderMapping?.evidenceOfNeed) {
            validateCitationArray(
                planning.stakeholderMapping.evidenceOfNeed,
                `Follow-up > stakeholderMapping > evidenceOfNeed`
            );
        }
        
        // nextCallObjectives
        if (planning.nextCallObjectives) {
            planning.nextCallObjectives.forEach((objective, idx) => {
                if (objective.customerEvidence) {
                    validateCitationArray(
                        objective.customerEvidence,
                        `Follow-up > nextCallObjectives[${idx}] > customerEvidence`
                    );
                }
            });
        }
        
        // opportunityIndicators - uses CustomerCitation as single object
        if (planning.opportunityIndicators) {
            planning.opportunityIndicators.forEach((indicator, idx) => {
                if (indicator.customerQuote) {
                    totalCitations++;
                    const validation = this.validateCustomerCitation(
                        indicator.customerQuote,
                        `Follow-up > opportunityIndicators[${idx}] > customerQuote`
                    );
                    if (!validation.isValid) {
                        validation.errors.forEach(error => {
                            invalidCitations.push({
                                location: `Follow-up > opportunityIndicators[${idx}]`,
                                error
                            });
                        });
                    }
                }
            });
        }
    }
    
    // Add warnings for common issues
    if (totalCitations === 0) {
        warnings.push('No citations found in analysis - verify if transcript was available');
    }
    
    if (invalidCitations.length > 0) {
        warnings.push(`Found ${invalidCitations.length} citations with format errors`);
    }
    
    return {
        isCompliant: invalidCitations.length === 0,
        totalCitations,
        invalidCitations,
        warnings
    };
}


private logCitationValidation(analysis: Partial<CallAnalysis>, callId: string): void {
    const validation = this.validateCitationFormat(analysis);
    
    console.log(`\n📊 Citation Format Validation for ${callId}:`);
    console.log(`   ✓ Total CustomerCitation objects: ${validation.totalCitations}`);
    console.log(`   ✓ Format compliant: ${validation.isCompliant ? 'YES' : 'NO'}`);
    
    if (validation.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        validation.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (validation.invalidCitations.length > 0) {
        console.log(`\n❌ Invalid Citations Found:`);
        validation.invalidCitations.forEach(invalid => {
            console.log(`   📍 ${invalid.location}`);
            console.log(`      ${invalid.error}`);
        });
    }
    
    if (validation.isCompliant && validation.totalCitations > 0) {
        console.log(`\n✅ All CustomerCitation objects are properly formatted\n`);
    }
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
            const AnalysisSchema = z.object({
                overallScore: z.number().min(1).max(10).nullable(), // 1-10 or null
                analysisStatus: z.enum(['completed', 'error', 'incomplete']).optional(), // Optional for now
                errorReason: z.string().optional(),
                components: z.array(z.object({
                    name: z.string(),
                    overallScore: z.number().min(1).max(10).nullable(), // 1-10 or null
                    subComponents: z.array(z.object({
                        name: z.string(),
                        score: z.number().min(1).max(10).nullable(), // 1-10 or null
                        evidence: z.array(z.object({
                            speaker: z.string(),
                            timestamp: z.string().optional(),
                            quote: z.string(),
                            context: z.string().optional()
                        })),
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
        return {
            overallScore: null, // NULL for errors
            analysisStatus: 'error',
            errorReason: 'JSON parsing failed during analysis',
            components: [
                {
                    name: "Analysis Error",
                    overallScore: null,
                    subComponents: [
                        {
                            name: "Processing Error",
                            score: null,
                            evidence: ["JSON parsing failed - unable to extract analysis"],
                            qualitativeAssessment: "Analysis could not be completed due to JSON parsing error. This is a system issue.",
                            improvementSuggestions: ["Check system logs", "Retry analysis", "Contact support if issue persists"]
                        }
                    ],
                    keyFindings: ["Analysis failed due to technical error - not a call quality issue"]
                }
            ],
            executiveSummary: {
                strengths: [],
                weaknesses: ["Analysis error: JSON parsing failed"],
                recommendations: ["Retry analysis", "Check system configuration", "Contact support if issue persists"]
            }
        };
    }

    private formatTimestamp(startTimeMs: number): string {
        const totalSeconds = Math.floor(startTimeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    private getSpeakerDisplayName(speakerName: string): string {
        if (!speakerName || speakerName === 'Unknown' || speakerName.startsWith('Speaker (')) {
            return 'Unknown Speaker';
        }
        
        // Remove any title in parentheses (e.g., "John Smith (VP Sales)" -> "John Smith")
        const nameWithoutTitle = speakerName.replace(/\s*\([^)]*\)/, '').trim();
        
        // Split name and use first name if available
        const nameParts = nameWithoutTitle.split(/\s+/);
        if (nameParts.length > 1) {
            return nameParts[0]; // Return first name only
        }
        
        return nameWithoutTitle; // Return full name if only one part
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
        const hasTranscript = callDetails?.hasTranscript && callDetails?.transcript && callDetails.transcript.length > 0;
        const hasBasicData = callDetails?.title && callDetails?.callId;
    
        // Determine analysis status and error reason
        let analysisStatus: 'error' | 'incomplete';
        let errorReason: string;
        let evidenceMessage: string;
        let assessmentMessage: string;
        let recommendationMessage: string;
    
        if (!hasTranscript) {
            analysisStatus = 'incomplete';
            errorReason = "No transcript available for analysis";
            evidenceMessage = "No transcript available - unable to perform framework analysis";
            assessmentMessage = "Analysis cannot be completed without call transcript. This is not a reflection of call quality.";
            recommendationMessage = "Obtain transcript from Gong to enable analysis";
        } else if (hasBasicData && hasTranscript) {
            analysisStatus = 'error';
            errorReason = "Technical error during analysis processing";
            evidenceMessage = "Analysis failed despite having transcript data";
            assessmentMessage = "Technical error occurred during analysis. Data was available but processing failed. This is a system issue, not a call quality issue.";
            recommendationMessage = "Check system logs and retry analysis";
        } else {
            analysisStatus = 'error';
            errorReason = "Insufficient call data";
            evidenceMessage = "Missing essential call data (title, ID, or transcript)";
            assessmentMessage = "Unable to analyze due to missing call information. This is a data issue, not a call quality issue.";
            recommendationMessage = "Verify call data in Gong and retry";
        }
    
        // Create error components with null scores
        const components: ComponentAnalysis[] = framework.components.map(comp => ({
            name: comp.name,
            overallScore: null, // NULL instead of artificial score
            subComponents: comp.subComponents.map(sub => ({
                name: sub.name,
                score: null, // NULL instead of artificial score
                evidence: [evidenceMessage],
                qualitativeAssessment: assessmentMessage,
                improvementSuggestions: [recommendationMessage, "Manual review recommended if needed"]
            })),
            keyFindings: [`Analysis could not be completed: ${errorReason}`]
        }));
    
        return {
            overallScore: null, // NULL - don't artificially score errors
            analysisStatus,
            errorReason,
            components,
            executiveSummary: {
                strengths: [], // No strengths for error cases
                weaknesses: [`Analysis ${analysisStatus}: ${errorReason}`],
                recommendations: [recommendationMessage, "This is not a scored analysis - system issue only"]
            }
        };
    }

    private formatError(error: any): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    private createErrorAnalysis(callId: string, callDetails: any, framework: any, error: any): CallAnalysis {
        // Since this is an error handler, we can't easily make it async
        // So we'll need to handle framework definition differently here
        const frameworkName = typeof framework === 'string' 
            ? framework 
            : framework.name || framework.displayName || 'Unknown Framework';
        
        return {
            callId,
            callTitle: callDetails?.title || 'Unknown Call',
            callUrl: callDetails?.callUrl || `https://app.gong.io/call?id=${callId}`,
            callDate: callDetails?.date || 'Unknown',
            participants: this.extractParticipants(callDetails || {}),
            duration: callDetails?.duration || 'Unknown',
            framework: frameworkName,
            overallScore: null, // ✅ NULL for errors (not 0)
            analysisStatus: 'error', // ✅ Mark as error
            errorReason: error instanceof Error ? error.message : 'Unknown error', // ✅ Add error reason
            components: [], // Empty components for error cases
            executiveSummary: {
                strengths: [],
                weaknesses: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
                recommendations: ['Retry analysis when system is stable', 'Check system logs for details']
            },
            followUpCallPlanning: this.createDefaultFollowUpPlan(callDetails || {}, frameworkName)
        };
    }

    private generateAggregateAnalysis(callAnalyses: CallAnalysis[], frameworks: string[]): AggregateAnalysis {
        console.log('📊 Generating aggregate insights...');
    
        const totalCalls = callAnalyses.length;
        if (totalCalls === 0) {
            throw new Error("No call analyses available for aggregation");
        }
    
        // Filter out null scores for aggregate calculations
        const scoredCalls = callAnalyses.filter(analysis => analysis.overallScore !== null);
        const scoredCallCount = scoredCalls.length;
        
        // Calculate aggregate score only from scored calls
        const overallScore = scoredCallCount > 0
            ? scoredCalls.reduce((sum, analysis) => sum + (analysis.overallScore as number), 0) / scoredCallCount
            : null; // null if no calls were successfully scored
    
        // Aggregate insights across SCORED calls only
        const allStrengths = scoredCalls.flatMap(analysis => analysis.executiveSummary.strengths);
        const allWeaknesses = scoredCalls.flatMap(analysis => analysis.executiveSummary.weaknesses);
    
        // Find common patterns
        const strengthCounts = this.countOccurrences(allStrengths);
        const weaknessCounts = this.countOccurrences(allWeaknesses);
    
        const aggregateInsights: any = {
            strengthsAcrossCalls: this.getTopItems(strengthCounts, 5),
            weaknessesAcrossCalls: this.getTopItems(weaknessCounts, 5),
            improvementOpportunities: this.generateImprovementOpportunities(scoredCalls) // Use scoredCalls
        };
    
        // Add note about unscored calls if any exist
        const unscoredCount = totalCalls - scoredCallCount;
        if (unscoredCount > 0) {
            aggregateInsights.weaknessesAcrossCalls.push(
                `⚠️ ${unscoredCount} of ${totalCalls} calls could not be scored due to analysis errors`
            );
        }
    
        // Framework comparison if multiple frameworks analyzed
        if (frameworks.length > 1) {
            const commandScores = scoredCalls // Use scoredCalls
                .filter(a => a.framework === "Command of the Message")
                .map(a => a.overallScore as number);
            const demoScores = scoredCalls // Use scoredCalls
                .filter(a => a.framework === "Great Demo")
                .map(a => a.overallScore as number);
    
            aggregateInsights.frameworkComparison = {
                commandOfMessage: commandScores.length > 0 ?
                    commandScores.reduce((a, b) => a + b, 0) / commandScores.length : undefined,
                greatDemo: demoScores.length > 0 ?
                    demoScores.reduce((a, b) => a + b, 0) / demoScores.length : undefined,
                insights: this.generateFrameworkComparisonInsights(commandScores, demoScores)
            };
        }
    
        console.log('✅ Aggregate analysis complete');
        console.log(`   - Total calls: ${totalCalls}`);
        console.log(`   - Scored calls: ${scoredCallCount}`);
        console.log(`   - Unscored calls: ${unscoredCount}`);
        console.log(`   - Aggregate score: ${overallScore !== null ? overallScore.toFixed(2) : 'N/A'}`);
    
        return {
            totalCalls: totalCalls,
            scoredCalls: scoredCallCount, // NEW field
            frameworks,
            overallScore,
            callAnalyses, // Include ALL calls (scored and unscored)
            aggregateInsights,
            recommendations: this.generateAggregateRecommendations(scoredCalls, aggregateInsights) // Use scoredCalls
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
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([item]) => item);
    }

    private generateImprovementOpportunities(callAnalyses: CallAnalysis[]): string[] {
        // Analyze common patterns across weak areas
        const commonWeakAreas = callAnalyses
            .flatMap(analysis =>
                analysis.components.flatMap(comp =>
                    comp.subComponents
                        .filter(sub => sub.score !== null && sub.score <= 6)
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
        // Filter out null scores
        const scoredCalls = callAnalyses.filter(call => call.overallScore !== null);
        
        if (scoredCalls.length === 0) {
            return {
                immediate: ['No scored calls available - check analysis system'],
                strategic: ['Resolve analysis errors to enable recommendations'],
                coaching: ['Manual call review required until scoring is operational']
            };
        }
        
        const lowestScoringCall = scoredCalls.reduce((lowest, current) =>
            (current.overallScore as number) < (lowest.overallScore as number) ? current : lowest
        );
    
        const highestScoringCall = scoredCalls.reduce((highest, current) =>
            (current.overallScore as number) > (highest.overallScore as number) ? current : highest
        );
    
        const averageScore = scoredCalls.reduce((sum, analysis) => 
            sum + (analysis.overallScore as number), 0
        ) / scoredCalls.length;
    
        const immediate: string[] = [];
        const strategic: string[] = [];
        const coaching: string[] = [];
    
        // NEW THRESHOLDS (implementing recalibration)
        if ((lowestScoringCall.overallScore as number) <= 3) { // Changed from < 5
            immediate.push(`🚨 IMMEDIATE: Review ${lowestScoringCall.callTitle} (Score: ${lowestScoringCall.overallScore}) - Poor performance requires immediate coaching`);
        }
    
        if (averageScore < 5) { // Changed from < 6
            strategic.push(`⚠️ Team average (${averageScore.toFixed(1)}) below target - implement systematic framework training`);
        }
    
        if (averageScore >= 6) {
            strategic.push(`✅ Team average (${averageScore.toFixed(1)}) meets target - continue current approach`);
        }
    
        if ((highestScoringCall.overallScore as number) >= 9) { // Changed from > 7
            coaching.push(`⭐ SHARE: ${highestScoringCall.callTitle} (Score: ${highestScoringCall.overallScore}) - Excellent execution, use as coaching example`);
        }
    
        // Add note about unscored calls if any
        const unscoredCount = callAnalyses.length - scoredCalls.length;
        if (unscoredCount > 0) {
            immediate.push(`ℹ️ Note: ${unscoredCount} call(s) could not be scored due to analysis errors - review separately`);
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
            scoredCalls: 0, // NEW: No calls were scored due to error
            frameworks: args.frameworks || [],
            overallScore: null, // NEW: Changed from 0 to null
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