// services/prompt-manager.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { FrameworkResources } from './framework-analyzer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PromptContext {
    callTitle: string;
    callDate: string;
    callDuration: string;
    participantInfo?: string;
    transcriptInfo: string;
    frameworkName: string;
    frameworkDescription: string;
    frameworkComponents: string;
    methodologyContent?: string;
    scoringExamples?: string;
    methodologyGuidance?: string;
    transcriptGuidance?: string;
    resourcesAvailable?: string;
    resourcesGuidance?: string;
    transcriptGuidelines?: string;
}

export interface SystemPromptContext {
    resourcesAvailable?: string;
    methodologyGuidance?: string;
    resourcesGuidance?: string;
    transcriptGuidelines?: string;
}

export class PromptManager {
    private promptCache: Map<string, string> = new Map();
    private promptsPath: string;

    constructor(promptsPath?: string) {
        this.promptsPath = promptsPath || path.join(__dirname, 'resources', 'prompts');
    }

    async renderSystemPrompt(templateName: string, context: SystemPromptContext): Promise<string> {
        const template = await this.loadPromptTemplate(templateName);
        let rendered = template;
    
        // Replace variables that exist
        for (const [key, value] of Object.entries(context)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), value || '');
        }
    
        // Clean up remaining placeholders
        rendered = rendered.replace(/\{\{[^}]*\}\}/g, '');
        return rendered;
    }

    async loadPromptTemplate(templateName: string): Promise<string> {
        // Check cache first
        if (this.promptCache.has(templateName)) {
            return this.promptCache.get(templateName)!;
        }

        try {
            const templatePath = path.join(this.promptsPath, `${templateName}.md`);
            const template = await fs.readFile(templatePath, 'utf8');
            
            // Cache the template
            this.promptCache.set(templateName, template);
            console.log(`✅ Loaded prompt template: ${templateName}`);
            
            return template;
        } catch (error) {
            console.error(`❌ Failed to load prompt template ${templateName}:`, error);
            throw new Error(`Prompt template '${templateName}' not found`);
        }
    }

    renderTemplate(template: string, context: PromptContext): string {
        let rendered = template;

        // Replace all {{variable}} placeholders
        for (const [key, value] of Object.entries(context)) {
            const placeholder = `{{${key}}}`;
            // Handle undefined values gracefully
            const replacement = value || '';
            rendered = rendered.replace(new RegExp(placeholder, 'g'), replacement);
        }

        // Clean up any remaining empty placeholders
        rendered = rendered.replace(/\{\{[^}]*\}\}/g, '');

        return rendered;
    }

    async renderPrompt(templateName: string, context: PromptContext): Promise<string> {
        const template = await this.loadPromptTemplate(templateName);
        return this.renderTemplate(template, context);
    }

    // Helper method to build framework components text
    buildFrameworkComponentsText(framework: any): string {
        return framework.components.map((comp: any) => `
## ${comp.name}
${comp.description}

**Sub-components:**
${comp.subComponents.map((sub: any) => `- **${sub.name}**: ${sub.description}`).join('\n')}
`).join('\n');
    }

    // Helper method to build participant info text
    buildParticipantInfo(participants: string[], includeParticipantRoles: boolean): string {
        if (!includeParticipantRoles || !participants.length) {
            return '';
        }
        return `\n**Participants**: ${participants.join(", ")}`;
    }

    // Helper method to build transcript info text
    buildTranscriptInfo(callDetails: any): string {
        const hasTranscript = callDetails.hasTranscript && callDetails.transcript && callDetails.transcript.length > 0;
        
        if (hasTranscript) {
            return `
## Call Transcript
*For detailed analysis and citations*

${this.enhanceTranscriptForCitations(callDetails.transcript)}

### Transcript Summary
- **Total Speakers**: ${callDetails.transcriptSummary?.totalSpeakers || 0}
- **Key Topics**: ${callDetails.transcriptSummary?.keyTopics?.join(", ") || "None identified"}
- **Duration**: ${callDetails.transcriptSummary?.totalDuration || 0} seconds
- **Speaker Breakdown**: ${JSON.stringify(callDetails.transcriptSummary?.speakerSummary || {}, null, 2)}
`;
        } else {
            return `
## Transcript Information
**TRANSCRIPT**: No transcript available for this call.

**IMPORTANT**: Since no transcript is available, base your analysis on:
- Call metadata (title, duration, participants)
- Framework methodology and best practices
- General sales call patterns and expectations
- Use "No transcript available" as evidence when specific examples cannot be cited
- Focus on framework application rather than specific call content
`;
        }
    }

    // Helper method to enhance transcript for citations (moved from framework-analyzer)
    private enhanceTranscriptForCitations(transcript: any[]): string {
        if (!transcript || transcript.length === 0) {
            return "No transcript available for this call.";
        }

        return transcript.map((entry, index) => {
            const speaker = entry.speaker || entry.speakerId || 'Unknown';
            const content = entry.content || entry.text || entry.sentence || '';
            const timestamp = entry.startTime ? `[${Math.floor(entry.startTime / 1000)}s]` : `[${index + 1}]`;
            return `${timestamp} ${speaker}: ${content}`;
        }).join('\n');
    }

    // Build context for enhanced analysis
    buildEnhancedAnalysisContext(
        framework: any,
        resources: any,
        callDetails: any,
        includeParticipantRoles: boolean
    ): PromptContext {
        return {
            callTitle: callDetails.title,
            callDate: callDetails.date,
            callDuration: callDetails.duration,
            participantInfo: this.buildParticipantInfo(
                this.extractParticipants(callDetails),
                includeParticipantRoles
            ),
            transcriptInfo: this.buildTranscriptInfo(callDetails),
            frameworkName: framework.name,
            frameworkDescription: framework.description,
            frameworkComponents: this.buildFrameworkComponentsText(framework),
            methodologyContent: resources.methodology || '',
            scoringExamples: resources.scoringExamples || '',
            methodologyGuidance: resources.methodology ? ' based on methodology best practices' : '',
            transcriptGuidance: this.buildTranscriptGuidance(callDetails),
            resourcesAvailable: resources.methodology ? ' You have access to comprehensive methodology guides and practical examples.' : '',
            resourcesGuidance: resources.methodology ? ' Use the provided framework methodology and examples to guide your analysis and ensure recommendations align with proven best practices.' : '',
            transcriptGuidelines: this.buildTranscriptGuidelines()
        };
    }

    // Build context for basic analysis
    buildBasicAnalysisContext(
        framework: any,
        callDetails: any,
        includeParticipantRoles: boolean
    ): PromptContext {
        return {
            callTitle: callDetails.title,
            callDate: callDetails.date,
            callDuration: callDetails.duration,
            participantInfo: this.buildParticipantInfo(
                this.extractParticipants(callDetails),
                includeParticipantRoles
            ),
            transcriptInfo: this.buildTranscriptInfo(callDetails),
            frameworkName: framework.name,
            frameworkDescription: framework.description,
            frameworkComponents: this.buildFrameworkComponentsText(framework)
        };
    }

    // Build system prompt context
    buildSystemPromptContext(resources: any, callDetails: any): SystemPromptContext {
        return {
            resourcesAvailable: resources?.methodology ? ' You have access to comprehensive methodology guides and practical examples.' : '',
            methodologyGuidance: resources?.methodology ? ' based on methodology best practices' : '',
            resourcesGuidance: resources?.methodology ? ' Use the provided framework methodology and examples to guide your analysis and ensure recommendations align with proven best practices.' : '',
            transcriptGuidelines: this.buildTranscriptGuidelines()
        };
    }

    private buildTranscriptGuidance(callDetails: any): string {
        const hasTranscript = callDetails.hasTranscript && callDetails.transcript && callDetails.transcript.length > 0;
        
        if (hasTranscript) {
            return 'Use specific quotes and moments from the transcript to support your analysis.';
        } else {
            return `
## No Transcript Available
- Base analysis on call metadata (title, duration, participants)
- Use framework methodology and best practices as guidance  
- Use "No transcript available" as evidence when specific examples cannot be cited
- Focus on framework application rather than specific call content
- Provide realistic scores based on available information
`;
        }
    }

    private buildTranscriptGuidelines(): string {
        return `
**If no transcript is available:**
- Base analysis on call metadata (title, duration, participants)
- Use framework methodology and best practices as guidance
- Use "No transcript available" as evidence when specific examples cannot be cited
- Focus on framework application rather than specific call content
- Provide realistic scores based on available information
`;
    }

    private extractParticipants(callDetails: any): string[] {
        if (callDetails.participants && Array.isArray(callDetails.participants)) {
            return callDetails.participants.map((p: any) => p.name || p.email || p.toString());
        }
        return ["Unknown"];
    }
}