# Basic Framework Analysis Prompt Template

Analyze this sales call against the {{frameworkName}} framework.

## Call Information
- **Title**: {{callTitle}}
- **Date**: {{callDate}}
- **Duration**: {{callDuration}}
{{participantInfo}}{{callBrief}}

{{transcriptInfo}}

## Framework: {{frameworkName}}
{{frameworkDescription}}

## Components to Analyze
{{frameworkComponents}}

Provide analysis in JSON format with components, scores (1-10), evidence from transcript, and recommendations.

## Response Format
```json
{
  "callBrief": "Gong AI-generated brief summary of the call (use the brief provided in the Call Information section above)",
  "overallScore": <number>,
  "components": [...],
  "executiveSummary": {
    "strengths": [...],
    "weaknesses": [...],
    "recommendations": [...]
  }
}
```

**IMPORTANT**: Include the "callBrief" field at the top of your JSON response using the Gong brief from the Call Information section.

**Respond with ONLY the JSON object.**