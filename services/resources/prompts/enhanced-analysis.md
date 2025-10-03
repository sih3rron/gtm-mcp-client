# Enhanced Framework Analysis Prompt Template

## Call Information
- **Title**: {{callTitle}}
- **Date**: {{callDate}}
- **Duration**: {{callDuration}}
{{participantInfo}}{{callBrief}}

{{transcriptInfo}}

## Framework Analysis: {{frameworkName}}
{{frameworkDescription}}

## Methodology Context
{{methodologyContent}}

## Components to Analyze
{{frameworkComponents}}

## Scoring Examples and Guidelines
{{scoringExamples}}

---

## CRITICAL CITATION FORMATTING REQUIREMENTS

**MANDATORY**: Use CustomerCitation objects with this structure:

```json
{
  "speaker": "John" or "Sarah Chen" or "Unknown Speaker",
  "timestamp": "mm:ss - mm:ss" (e.g., "5:23 - 5:35", "12:45 - 12:52"),
  "quote": "Exact or paraphrased quote from the call",
  "context": "Why this matters and how it supports the analysis"
}
```

**Note**: The `url` field will be automatically generated based on the timestamp you provide, creating clickable links to the exact moment in the Gong call recording. You don't need to include it in your response.

### Citation Rules:

1. **CustomerCitation Object Structure** (REQUIRED):
   - `speaker`: Speaker's name (first name preferred) or "Unknown Speaker"
   - `timestamp`: Time range in mm:ss - mm:ss format (e.g., "5:23 - 5:35") - REQUIRED format
   - `quote`: The actual quote or paraphrased content from the call
   - `context`: Explanation of significance (optional but recommended)
   - `url`: Clickable Gong link (automatically generated - do not include)

2. **Timestamp Format** (CRITICAL):
   - ✅ CORRECT: "5:23 - 5:35", "12:45 - 12:52", "0:15 - 0:23", "65:30 - 65:45"
   - ❌ INCORRECT: "~5min", "300s", "around 5 minutes", "5min", "5:23" (no range)

3. **Speaker Names**:
   - ✅ CORRECT: "John", "Sarah Chen", "Unknown Speaker"
   - ❌ INCORRECT: "Speaker 1", "Speaker (abc123...)", "speaker_id_123"

4. **When to include citations**:
   - Include in evidence arrays whenever transcript supports your analysis
   - Provide citations to demonstrate reasoning for scores, suggestions, and insights
   - It is STRONGLY PREFERRED to provide evidence wherever possible

5. **When citations are not required**:
   - If no transcript evidence exists, omit the evidence array or use empty array
   - If a component was not discussed, you may include a note in qualitativeAssessment
   - NEVER fabricate citations

---

## Analysis Instructions

Provide your analysis in the following JSON format:

```json
{
  "callBrief": "Gong AI-generated brief summary of the call (use the brief provided in the Call Information section above)",
  "overallScore": <number 1-10>,
  "components": [
    {
      "name": "Component Name",
      "overallScore": <number 1-10>,
      "subComponents": [
        {
          "name": "Sub-component Name",
          "score": <number 1-10>,
          "evidence": [
          {
            "speaker": "John",
            "timestamp": "5:23 - 5:30",
            "quote": "We're currently spending about $50K annually on this process",
            "context": "Indicates budget constraints and sets baseline for value calculation"
          },
          {
            "speaker": "Sarah",
            "timestamp": "8:15 - 8:25",
            "quote": "The 6-month implementation timeline is concerning for us",
            "context": "Shows timeline as a key decision factor and potential objection"
          }
          ],
          "qualitativeAssessment": "Detailed assessment text explaining the score",
          "improvementSuggestions": [
            "Specific actionable recommendation based on evidence"
          ]
        }
      ],
      "keyFindings": [
        "Key insight about this component (may reference evidence by timestamp)"
      ]
    }
  ],
  "executiveSummary": {
    "strengths": [
      "What went well (may include timestamp references like 'at 5:23')"
    ],
    "weaknesses": [
      "Areas for improvement (may include timestamp references)"
    ],
    "recommendations": [
      "Strategic recommendations based on call evidence"
    ]
  },
  "followUpCallPlanning": {
    "overallStrategy": "Next call strategy based on this call's findings",
    "deeperInquiryAreas": [
      {
        "area": "Area needing more discovery",
        "reason": "Why this needs deeper inquiry",
        "suggestedQuestions": ["Question 1", "Question 2"],
        "priority": "high",
        "supportingEvidence": [
          {
            "speaker": "John",
            "timestamp": "10:30",
            "quote": "We haven't really quantified the impact yet",
            "context": "Indicates need for value quantification discussion"
          }
        ]
      }
    ],
    "unansweredQuestions": [
      {
        "question": "Question not answered in this call",
        "context": "Why this question matters",
        "frameworkComponent": "Related framework component",
        "originalCustomerResponse": {
          "speaker": "Sarah",
          "timestamp": "15:20",
          "quote": "I'll need to check with finance on that",
          "context": "Deflection indicating information gap"
        },
        "whyIncomplete": "Explanation of why answer is incomplete"
      }
    ],
    "discoveryGaps": [
      {
        "gapArea": "Missing discovery area",
        "impact": "Impact of this gap",
        "discoveryApproach": "How to address in next call",
        "indicatorQuotes": [
          {
            "speaker": "John",
            "timestamp": "18:45",
            "quote": "Quote indicating this gap",
            "context": "Why this indicates a discovery gap"
          }
        ]
      }
    ],
    "stakeholderMapping": {
      "currentParticipants": ["Current participants from this call"],
      "missingStakeholders": ["Who else should be involved"],
      "recommendedInvites": ["Specific people to invite with rationale"],
      "evidenceOfNeed": [
        {
          "speaker": "Sarah",
          "timestamp": "22:10",
          "quote": "The CFO will definitely want to review this",
          "context": "Indicates need to involve CFO in decision process"
        }
      ]
    },
    "nextCallObjectives": [
      {
        "objective": "Specific objective for next call",
        "rationale": "Why this objective matters",
        "customerEvidence": [
          {
            "speaker": "John",
            "timestamp": "25:30",
            "quote": "Quote supporting this objective",
            "context": "How this supports the objective"
          }
        ]
      }
    ],
    "opportunityIndicators": [
      {
        "indicator": "Sign of sales opportunity",
        "customerQuote": {
          "speaker": "Sarah",
          "timestamp": "28:15",
          "quote": "If we can solve this, budget won't be an issue",
          "context": "Strong buying signal indicating high priority"
        },
        "followUpAction": "Specific action to take",
        "potentialValue": "Estimated value or impact"
      }
    ]
  }
}
```

---

## Analysis Guidelines

**IMPORTANT**: Your JSON response MUST include the "callBrief" field at the top, using the Gong AI Call Brief provided in the Call Information section above. Simply copy it into your response.

1. **Evidence-based scoring**: Look for specific examples in the call content when available
2. **Use the full 1-10 range**: Don't cluster in the middle - spread scores authentically
3. **Methodology alignment**: {{methodologyGuidance}}
4. **Citation format compliance**: STRICTLY use CustomerCitation object structure with mm:ss timestamps
5. **Actionable recommendations**: Provide specific, implementable suggestions
6. **Be honest about poor performance**: If a call deserves a low score, give it that score
7. **Handle missing coverage**: If a component wasn't discussed, state "This component was not covered in the call"

{{transcriptGuidance}}

---

## Scoring Decision Framework

**When in doubt, ask yourself:**

1. "What specific customer evidence supports this score?" (If none → lower score or note lack of coverage)
2. "Did the customer actively engage and validate?" (If no → score ≤6)
3. "Was there quantification and business impact?" (If no → score ≤6)
4. "Am I artificially boosting this score?" (If yes → use evidence-based score)
5. "Would a sales leader agree this score matches the evidence?" (If no → revise)
6. "Are my citations properly formatted CustomerCitation objects with mm:ss timestamps?" (If no → fix immediately)

**Remember:**
- A score of 2-3 is not an insult - it's valuable feedback
- Accurate low scores enable targeted coaching
- The goal is improvement, not feeling good
- Your scoring helps identify what actually works
- Citations demonstrate your reasoning and build credibility

---

**CRITICAL**: Respond with ONLY the JSON object, no other text. Ensure ALL citations use CustomerCitation object structure with mm:ss timestamps.