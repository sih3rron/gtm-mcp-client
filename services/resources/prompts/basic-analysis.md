# Basic Framework Analysis Prompt Template

Analyze this sales call against the {{frameworkName}} framework.

## Call Information
- **Title**: {{callTitle}}
- **Date**: {{callDate}}
- **Duration**: {{callDuration}}
{{participantInfo}}

{{transcriptInfo}}

## Framework: {{frameworkName}}
{{frameworkDescription}}

## Components to Analyze
{{frameworkComponents}}

Provide analysis in JSON format with components, scores (1-10), evidence from transcript, and recommendations.

## Response Format
```json
{
  "overallScore": <number>,
  "components": [...],
  "executiveSummary": {
    "strengths": [...],
    "weaknesses": [...],
    "recommendations": [...]
  }
}
```

**Respond with ONLY the JSON object.**