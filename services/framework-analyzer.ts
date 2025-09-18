// services/framework-analyzer.ts
import dotenv from 'dotenv';
import { jsonrepair } from 'jsonrepair';
import { z } from 'zod';

import {
    FrameworkDefinition,
    CallAnalysis,
    AggregateAnalysis,
    ComponentAnalysis,
    SubComponentScore,
    getFrameworkDefinition,
    validateFrameworkName,
    ValidFramework
} from './framework-definitions.js';

dotenv.config({ path: '.env.local' });

// Validation helpers
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
        const validFrameworks = ["command_of_message", "great_demo"];
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

    constructor(anthropicClient: any, gongService: any) {
        this.anthropicClient = anthropicClient;
        this.gongService = gongService;
    }

    // Main analysis method
    async analyzeCallsFramework(args: {
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
                // Get call details using existing Gong integration
                const callDetails = await this.gongService.getGongCallDetails({ callId });
                console.log(`✅ Got call details for ${callId}:`, callDetails.callId);
                console.log(`🔍 Framework Analyzer received callDetails:`, JSON.stringify({
                    callId: callDetails.callId,
                    title: callDetails.title,
                    date: callDetails.date,
                    duration: callDetails.duration,
                    participants: callDetails.participants,
                    hasTranscript: callDetails.hasTranscript,
                    transcriptLength: callDetails.transcript?.length || 0,
                    transcriptSummary: callDetails.transcriptSummary ? {
                        totalSpeakers: callDetails.transcriptSummary.totalSpeakers,
                        keyTopics: callDetails.transcriptSummary.keyTopics,
                        totalDuration: callDetails.transcriptSummary.totalDuration
                    } : null
                }, null, 2));
                
                // Analyze against each requested framework
                for (const framework of frameworks) {
                    try {
                        console.log(`🧠 Analyzing call ${callId} against ${framework} framework`);
                        const analysis = await this.analyzeCallAgainstFramework(
                            callDetails, 
                            framework as ValidFramework, 
                            includeParticipantRoles
                        );
                        callAnalyses.push(analysis);
                        console.log(`✅ Completed ${framework} analysis for call ${callId}, score: ${analysis.overallScore}`);
                    } catch (frameworkError) {
                        console.error(`❌ Error analyzing call ${callId} against ${framework} framework:`, this.formatError(frameworkError));
                        // Create a fallback analysis for this specific framework
                        const fallbackAnalysis = this.createErrorAnalysis(callId, callDetails, framework, frameworkError);
                        callAnalyses.push(fallbackAnalysis);
                    }
                }
            } catch (callError) {
                console.error(`❌ Error fetching call details for ${callId}:`, this.formatError(callError));
                // Create a fallback analysis for this call
                const fallbackAnalysis = this.createErrorAnalysis(callId, null, frameworks[0], callError);
                callAnalyses.push(fallbackAnalysis);
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
        const frameworkDef = getFrameworkDefinition(framework);

        // Add logging for Duration and CallDate
        console.log('🔍 Framework Analysis - CallDate and Duration Debug:');
        console.log('  - callDetails.date:', callDetails.date);
        console.log('  - callDetails.duration:', callDetails.duration);
        console.log('  - callDetails keys:', Object.keys(callDetails));
        console.log('  - callDetails type:', typeof callDetails);

        // Prepare analysis context
        const analysisContext = {
            callDetails,
            framework: frameworkDef,
            includeParticipantRoles
        };

        console.log(`🔬 Performing detailed analysis for ${frameworkDef.name}`);

        // Use Anthropic to analyze the call content
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
            executiveSummary: analysis.executiveSummary ?? { strengths: [], weaknesses: [], recommendations: [] }
        };
    }

    private async performFrameworkAnalysis(context: any): Promise<Partial<CallAnalysis>> {
        const { callDetails, framework, includeParticipantRoles } = context;
        
        console.log(`🧠 Building analysis prompt for ${framework.name}`);
        const analysisPrompt = this.buildAnalysisPrompt(framework, callDetails, includeParticipantRoles);
        let responseText: string = '';
        
        try {
            console.log('📡 Calling Anthropic for framework analysis...');
            const modelId = process.env.ANTHROPIC_MODEL;
            console.log('🔍 Using model:', modelId);
            const response = await this.anthropicClient.messages.create({
                model: modelId,
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: analysisPrompt
                }],
                system: `You are an expert sales methodology analyst. Analyze sales calls against established frameworks with precision and insight. 

                CRITICAL: Your response MUST be valid JSON only, no other text. Structure your response exactly as specified in the prompt.

                Focus on:
                1. Evidence-based scoring (look for specific examples in the call content)
                2. Actionable improvement suggestions
                3. Clear qualitative assessments
                4. Realistic scoring (most calls will score 4-7, perfect 10s are rare)
                
                Be thorough but realistic. Look for actual evidence in the call content to support your scores.`
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
            console.log('✅ Successfully parsed analysis result');
            
            // Validate and enhance citations
            const citationValidation = this.validateCitations(analysisResult);
            console.log(`🔍 Citation validation:`, {
                hasCitations: citationValidation.hasCitations,
                citationCount: citationValidation.citationCount,
                missingCitations: citationValidation.missingCitations.length
            });
            
            // Enhance analysis with citations if needed
            const enhancedAnalysis = this.enhanceAnalysisWithCitations(analysisResult, callDetails);
            
            // Generate citation quality report
            const citationReport = this.generateCitationReport(enhancedAnalysis);
            console.log(`📊 Citation Quality Report:`, {
                quality: citationReport.citationQuality,
                totalCitations: citationReport.totalCitations,
                recommendations: citationReport.recommendations
            });
            
            return enhancedAnalysis;
        } catch (error) {
            console.error('❌ Error in framework analysis:', this.formatError(error));
            
            // Enhanced error logging for JSON parsing issues
            if (error instanceof SyntaxError && error.message.includes('JSON')) {
                console.error('🔍 JSON Parsing Error Details:', {
                    errorMessage: error.message,
                    responseLength: responseText?.length || 0,
                    responsePreview: responseText?.substring(0, 200) || 'No response text',
                    responseEnd: responseText?.substring(Math.max(0, (responseText?.length || 0) - 200)) || 'No response text',
                    position: this.extractJsonErrorPosition(error.message)
                });
                
                // Try to extract and log the problematic JSON section
                const errorPosition = this.extractJsonErrorPosition(error.message);
                if (errorPosition && responseText) {
                    const start = Math.max(0, errorPosition - 100);
                    const end = Math.min(responseText.length, errorPosition + 100);
                    console.error('🔍 Problematic JSON section:', responseText.substring(start, end));
                }
            }
            
            // Log detailed error information for debugging
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
            : "\n\nTRANSCRIPT: No transcript available for this call.";

        return `
Analyze this sales call against the ${framework.name} framework.

Call Information:
- Call ID: ${callDetails.callId}
- Title: ${callDetails.title || "Unknown"} ${participantInfo}
- Highlights: ${JSON.stringify(callDetails.highlights || [])}
- Key Points: ${JSON.stringify(callDetails.keyPoints || [])}
- Brief: ${callDetails.brief || "No brief available"}
- Outline: ${callDetails.outline || "No outline available"}${transcriptInfo}

Framework: ${framework.name}
Description: ${framework.description}

Framework Components to Analyze:
${framework.components.map(comp => `
${comp.name}: ${comp.description}
Sub-components:
${comp.subComponents.map(sub => `  - ${sub.name}: ${sub.description}
    Keywords: ${sub.keywords.join(", ")}
    Scoring Criteria:
      Excellent (9-10): ${sub.scoringCriteria.excellent}
      Good (7-8): ${sub.scoringCriteria.good}
      Fair (5-6): ${sub.scoringCriteria.fair}
      Poor (1-4): ${sub.scoringCriteria.poor}`).join("\n")}
`).join("\n")}

Instructions:
1. Score each sub-component 1-10 based on evidence from the call content and transcript
2. MANDATORY: Provide specific evidence quotes/examples from the transcript for each score (include speaker attribution and timestamp when possible)
3. If transcript is available, prioritize transcript evidence over highlights/key points
4. Give qualitative assessment explaining the score based on actual conversation content
5. Suggest 2-3 specific improvements for each sub-component with reference to specific transcript moments
6. Calculate component averages and overall score
7. Create executive summary with top 3 strengths, weaknesses, and recommendations
8. When citing evidence, use format: "[Speaker Name, ~Xmin]: 'exact quote'"
9. CRITICAL: Every score must be supported by at least one transcript citation. If no direct evidence exists, explain why and suggest what to look for
10. For every finding, weakness, strength, and recommendation, include specific transcript references
11. Use multiple citations per component when available to provide comprehensive evidence
12. If transcript is not available, clearly state "No transcript available" and base analysis on available content

Return ONLY valid JSON in this exact format:
{
  "overallScore": number,
  "components": [
    {
      "name": "Component Name",
      "overallScore": number,
      "subComponents": [
        {
          "name": "Sub-component Name",
          "score": number,
          "evidence": ["[Speaker Name, ~Xmin]: 'Specific quote from transcript'", "Another example with citation"],
          "qualitativeAssessment": "Detailed explanation of score based on transcript analysis with specific citations",
          "improvementSuggestions": ["Specific suggestion 1 with transcript reference", "Specific suggestion 2 with citation"]
        }
      ],
      "keyFindings": ["Key insight 1 with transcript evidence", "Key insight 2"]
    }
  ],
  "executiveSummary": {
    "strengths": ["Top strength 1 with transcript citation", "Top strength 2", "Top strength 3"],
    "weaknesses": ["Top weakness 1 with specific transcript moment", "Top weakness 2", "Top weakness 3"],
    "recommendations": ["Top recommendation 1 with transcript reference", "Top recommendation 2", "Top recommendation 3"]
  }
}`;
    }

    private formatTranscriptForAnalysis(transcript: any[]): string {
        console.log(`🔍 Formatting transcript for analysis:`, {
            transcriptExists: !!transcript,
            transcriptLength: transcript?.length || 0,
            transcriptType: typeof transcript,
            isArray: Array.isArray(transcript)
        });
        
        if (!transcript || transcript.length === 0) {
            console.log(`🔍 No transcript available for formatting`);
            return "No transcript available";
        }

        console.log(`🔍 First transcript entry for formatting:`, JSON.stringify(transcript[0], null, 2));
        
        const formattedTranscript = transcript.map((entry, index) => {
            const timestamp = entry.startTime ? `[${Math.round(entry.startTime / 60)}min]` : `[${index}]`;
            const speaker = entry.speaker || 'Unknown';
            const text = entry.text || '';
            const topic = entry.topic ? ` (Topic: ${entry.topic})` : '';
            return `${timestamp} ${speaker}: "${text}"${topic}`;
        }).join('\n');
        
        console.log(`🔍 Formatted transcript length:`, formattedTranscript.length);
        console.log(`🔍 First 200 chars of formatted transcript:`, formattedTranscript.substring(0, 200));
        
        return formattedTranscript;
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

    private createFallbackAnalysis(framework: FrameworkDefinition, callDetails: any): Partial<CallAnalysis> {
        // Create a basic analysis structure when LLM analysis fails
        const components: ComponentAnalysis[] = framework.components.map(comp => ({
            name: comp.name,
            overallScore: 5, // Default neutral score
            subComponents: comp.subComponents.map(sub => ({
                name: sub.name,
                score: 5,
                evidence: ["Analysis unavailable due to processing error"],
                qualitativeAssessment: "Unable to analyze due to technical error. Manual review recommended.",
                improvementSuggestions: ["Review call manually", "Re-run analysis when system is stable"]
            })),
            keyFindings: ["Analysis incomplete due to system error"]
        }));

        return {
            overallScore: 5,
            components,
            executiveSummary: {
                strengths: ["Unable to determine - analysis error"],
                weaknesses: ["Analysis failed - manual review needed"],
                recommendations: ["Re-run analysis", "Manual call review", "Check system logs"]
            }
        };
    }

    private extractParticipants(callDetails: any): string[] {
        // Handle different possible participant field names
        if (callDetails.participants && Array.isArray(callDetails.participants)) {
            return callDetails.participants;
        }
        if (callDetails.parties && Array.isArray(callDetails.parties)) {
            return callDetails.parties;
        }
        if (typeof callDetails.participants === 'string') {
            return [callDetails.participants];
        }
        return ["Unknown participants"];
    }

    private formatError(error: any): string {
        if (error instanceof Error) {
            return `${error.name}: ${error.message}`;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && typeof error === 'object') {
            if (error.message) {
                return `Error: ${error.message}`;
            }
            if (error.error) {
                return `Error: ${error.error}`;
            }
            return `Unknown error: ${JSON.stringify(error)}`;
        }
        return 'Unknown error occurred';
    }

    private createErrorAnalysis(callId: string, callDetails: any, framework: string, error: any): CallAnalysis {
        const errorMessage = this.formatError(error);
        const frameworkDef = getFrameworkDefinition(framework as ValidFramework);
        
        return {
            callId,
            callTitle: callDetails?.title,
            callUrl: callDetails?.callUrl || `https://app.gong.io/call?id=${callId}`,
            callDate: callDetails?.date,
            participants: callDetails ? this.extractParticipants(callDetails) : ["Unknown"],
            duration: callDetails?.duration,
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
            const commandAvg = commandScores.reduce((a, b) => a + b, 0) / commandScores.length;
            const demoAvg = demoScores.reduce((a, b) => a + b, 0) / demoScores.length;
            
            if (Math.abs(commandAvg - demoAvg) > 1) {
                if (commandAvg > demoAvg) {
                    insights.push("Command of Message framework shows stronger performance than Great Demo approach");
                    insights.push("Consider focusing on discovery and value quantification skills");
                } else {
                    insights.push("Great Demo framework shows stronger performance than Command of Message approach");
                    insights.push("Consider focusing on business alignment and messaging skills");
                }
            } else {
                insights.push("Both frameworks show similar performance levels");
                insights.push("Consider integrated approach combining both methodologies");
            }
        }
        
        return insights;
    }

    private validateCitations(analysis: Partial<CallAnalysis>): {
        hasCitations: boolean;
        citationCount: number;
        missingCitations: string[];
    } {
        const missingCitations: string[] = [];
        let citationCount = 0;

        if (analysis.components) {
            analysis.components.forEach(component => {
                if (component.subComponents) {
                    component.subComponents.forEach(subComponent => {
                        if (subComponent.evidence && subComponent.evidence.length > 0) {
                            citationCount += subComponent.evidence.length;
                        } else {
                            missingCitations.push(`${component.name} - ${subComponent.name}`);
                        }
                    });
                }
                
                if (component.keyFindings) {
                    component.keyFindings.forEach(finding => {
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
            
            summaryFields.forEach(field => {
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
            
            // Last resort: return original
            return jsonText;
        }
    }

    private validateAnalysisStructure(analysis: any): void {
        try {
            // Define a flexible schema for the analysis structure
            const subComponentSchema = z.object({
                name: z.string(),
                score: z.number().min(1).max(10),
                evidence: z.array(z.string()).optional(),
                qualitativeAssessment: z.string().optional(),
                improvementSuggestions: z.array(z.string()).optional()
            });

            const componentSchema = z.object({
                name: z.string(),
                overallScore: z.number().min(1).max(10),
                subComponents: z.array(subComponentSchema).optional(),
                keyFindings: z.array(z.string()).optional()
            });

            const analysisSchema = z.object({
                overallScore: z.number().min(1).max(10),
                components: z.array(componentSchema).optional(),
                executiveSummary: z.object({
                    strengths: z.array(z.string()).optional(),
                    weaknesses: z.array(z.string()).optional(),
                    recommendations: z.array(z.string()).optional()
                }).optional()
            });

            // Validate the structure
            analysisSchema.parse(analysis);
            console.log('✅ Analysis structure validation passed');
        } catch (error) {
            console.warn('Analysis structure validation failed:', error);
            // Don't throw - just log the warning and continue
        }
    }

    private truncateToValidJson(jsonText: string): string | null {
        try {
            // Find the last complete object by counting braces
            let braceCount = 0;
            let bracketCount = 0;
            let inString = false;
            let escapeNext = false;
            let lastCompleteBrace = -1;
            
            for (let i = 0; i < jsonText.length; i++) {
                const char = jsonText[i];
                
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }
                
                if (!inString) {
                    if (char === '{') braceCount++;
                    else if (char === '}') {
                        braceCount--;
                        if (braceCount === 0 && bracketCount === 0) {
                            lastCompleteBrace = i;
                        }
                    }
                    else if (char === '[') bracketCount++;
                    else if (char === ']') bracketCount--;
                }
            }
            
            if (lastCompleteBrace !== -1) {
                const truncated = jsonText.substring(0, lastCompleteBrace + 1);
                JSON.parse(truncated); // Validate it's parseable
                return truncated;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    private extractJsonErrorPosition(errorMessage: string): number | null {
        const match = errorMessage.match(/position (\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    private generateCitationReport(analysis: Partial<CallAnalysis>): {
        totalCitations: number;
        citationsByComponent: { [key: string]: number };
        citationQuality: 'excellent' | 'good' | 'fair' | 'poor';
        recommendations: string[];
    } {
        const citationsByComponent: { [key: string]: number } = {};
        let totalCitations = 0;

        if (analysis.components) {
            analysis.components.forEach(component => {
                let componentCitations = 0;
                
                if (component.subComponents) {
                    component.subComponents.forEach(subComponent => {
                        if (subComponent.evidence && subComponent.evidence.length > 0) {
                            componentCitations += subComponent.evidence.length;
                            totalCitations += subComponent.evidence.length;
                        }
                    });
                }
                
                if (component.keyFindings) {
                    component.keyFindings.forEach(finding => {
                        if (finding.includes('[') && finding.includes(']')) {
                            componentCitations++;
                            totalCitations++;
                        }
                    });
                }
                
                citationsByComponent[component.name] = componentCitations;
            });
        }

        // Calculate citation quality
        const totalSubComponents = analysis.components?.reduce((total, comp) => 
            total + (comp.subComponents?.length || 0), 0) || 0;
        
        const citationRatio = totalSubComponents > 0 ? totalCitations / totalSubComponents : 0;
        
        let citationQuality: 'excellent' | 'good' | 'fair' | 'poor';
        if (citationRatio >= 2) citationQuality = 'excellent';
        else if (citationRatio >= 1.5) citationQuality = 'good';
        else if (citationRatio >= 1) citationQuality = 'fair';
        else citationQuality = 'poor';

        const recommendations: string[] = [];
        if (citationQuality === 'poor') {
            recommendations.push('Add more specific transcript citations to support analysis');
            recommendations.push('Include speaker names and timestamps in all evidence');
        } else if (citationQuality === 'fair') {
            recommendations.push('Consider adding more detailed citations for better evidence');
        }

        return {
            totalCitations,
            citationsByComponent,
            citationQuality,
            recommendations
        };
    }

    private generateAggregateRecommendations(callAnalyses: CallAnalysis[], aggregateInsights: any): {
        immediate: string[];
        strategic: string[];
        coaching: string[];
    } {
        const lowestScoringCall = callAnalyses.reduce((lowest, current) => 
            current.overallScore < lowest.overallScore ? current : lowest
        );

        return {
            immediate: [
                `Review call "${lowestScoringCall.callTitle}" (score: ${lowestScoringCall.overallScore.toFixed(1)}) for immediate coaching opportunities`,
                "Focus on top 3 weaknesses identified across calls",
                "Implement framework scorecards for ongoing call evaluation"
            ],
            strategic: [
                "Develop training program addressing common weak areas",
                "Create framework-specific talk tracks and resources",
                "Establish regular framework-based call review sessions"
            ],
            coaching: [
                "Use framework analysis for personalized coaching plans",
                "Role-play scenarios addressing identified weak components",
                "Set specific improvement targets for each framework component"
            ]
        };
    }
}

// Error handling wrapper for safe analysis
export const safeFrameworkAnalysis = async (analyzer: FrameworkAnalyzer, args: any): Promise<AggregateAnalysis> => {
    try {
        console.log('🔍 Starting safe framework analysis...');
        FrameworkAnalysisValidator.validateCallIds(args.callIds);
        FrameworkAnalysisValidator.validateFrameworks(args.frameworks);
        
        return await analyzer.analyzeCallsFramework(args);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('❌ Framework analysis error:', errorMessage);
        console.error('❌ Full error details:', error);
        
        return {
            error: true,
            message: `Analysis failed: ${errorMessage}`,
            totalCalls: 0,
            frameworks: args.frameworks || [],
            overallScore: 0,
            callAnalyses: [],
            aggregateInsights: {
                strengthsAcrossCalls: [],
                weaknessesAcrossCalls: [],
                improvementOpportunities: [
                    `Fix the error: ${errorMessage}`,
                    'Check call IDs are valid and accessible',
                    'Verify framework parameters are correct',
                    'Ensure Gong service is properly configured'
                ]
            },
            recommendations: {
                immediate: [
                    `Resolve error: ${errorMessage}`,
                    'Check call IDs and framework parameters',
                    'Verify Gong integration is working'
                ],
                strategic: [
                    'Ensure proper Gong integration',
                    'Check API credentials and permissions',
                    'Verify call data availability'
                ],
                coaching: [
                    'Verify analysis configuration',
                    'Check system logs for detailed error information',
                    'Contact support if error persists'
                ]
            }
        } as AggregateAnalysis;
    }
};