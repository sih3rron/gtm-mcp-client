# Enhanced Framework Analysis Prompt Template

## Call Information
- **Title**: {{callTitle}}
- **Date**: {{callDate}}
- **Duration**: {{callDuration}}
{{participantInfo}}

{{transcriptInfo}}

## Framework Analysis: {{frameworkName}}
{{frameworkDescription}}

## Methodology Context
{{methodologyContent}}

## Components to Analyze
{{frameworkComponents}}

## Scoring Examples and Guidelines
{{scoringExamples}}

## Analysis Instructions

Provide your analysis in the following JSON format:

```json
{
  "overallScore": <number 1-10>,
  "components": [
    {
      "name": "Component Name",
      "overallScore": <number 1-10>,
      "subComponents": [
        {
          "name": "Sub-component Name",
          "score": <number 1-10>,
          "evidence": ["Quote or observation from call"],
          "qualitativeAssessment": "Detailed assessment text",
          "improvementSuggestions": ["Specific actionable recommendation"]
        }
      ],
      "keyFindings": ["Key insight about this component"]
    }
  ],
  "executiveSummary": {
    "strengths": ["What went well"],
    "weaknesses": ["Areas for improvement"],
    "recommendations": ["Strategic recommendations"]
  },
  "followUpCallPlanning": {
    "overallStrategy": "Next call strategy",
    "deeperInquiryAreas": ["Areas needing more discovery"],
    "unansweredQuestions": ["Questions not answered"],
    "discoveryGaps": ["Missing discovery areas"],
    "stakeholderMapping": {
      "currentParticipants": ["Current participants"],
      "missingStakeholders": ["Who else should be involved"],
      "recommendedInvites": ["Specific people to invite"],
      "evidenceOfNeed": ["Evidence of broader need"]
    },
    "nextCallObjectives": [
      {
        "objective": "Specific objective",
        "rationale": "Why this objective",
        "customerEvidence": ["Evidence supporting this objective"]
      }
    ],
    "opportunityIndicators": ["Signs of sales opportunity"]
  }
}
```

## Analysis Guidelines

1. **Evidence-based scoring**: Look for specific examples in the call content when available
2. **Realistic scoring**: Most calls score 4-7; perfect 10s are rare
3. **Methodology alignment**: {{methodologyGuidance}}
4. **Clear citations**: Reference specific moments or quotes when possible. Include Speaker Name and time of citation within the context of the call transcript
5. **Actionable recommendations**: Provide specific, implementable suggestions

{{transcriptGuidance}}

**CRITICAL**: Respond with ONLY the JSON object, no other text.