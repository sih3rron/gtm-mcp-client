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

---

## Scoring Philosophy & Distribution

**Score the full range authentically.** Don't artificially cluster scores in the middle. Use the entire 1-10 scale based on evidence.

### Expected Score Distribution
Use these as guidelines for what a realistic distribution looks like across many calls:
- **1-3 (Poor)**: 20-30% of calls - Major framework gaps, minimal customer engagement
- **4-6 (Fair / Needs Improvement)**: 40-50% of calls - Basic execution, clear opportunities for improvement
- **7-8 (Good)**: 20-25% of calls - Solid framework application with minor gaps
- **9-10 (Excellent)**: 5-10% of calls - Masterful execution with strong business impact

### Detailed Scoring Guidelines by Range

#### 9-10 (Excellent)
**Characteristics:**
- Multiple components scored 9-10 with strong evidence
- Clear, quantified customer engagement and business impact
- Specific next steps with customer commitment and dates
- Customer-driven urgency and timeline
- All framework elements well-integrated

**Example Evidence:**
"$6.35M quarterly loss identified with 127 hours downtime, CEO mandate for Q4 resolution, 3-step action plan with specific dates established, customer commits to timeline"

**What's Required:**
- Specific customer quotes supporting high scores
- Quantified business impact with customer validation
- Clear timeline and urgency driven by customer
- Comprehensive framework application

---

#### 7-8 (Good)
**Characteristics:**
- Most components scored 7-8 with good evidence
- Clear problem identification with some quantification
- Customer engagement and acknowledgment present
- Next steps discussed with reasonable commitment
- Minor gaps in depth or customer validation

**Example Evidence:**
"80 hours/month manual process identified, customer confirms pain and regulatory pressure, some quantification present, timeline discussed with customer interest"

**What's Required:**
- Customer confirmation of problems/value
- Some quantification or specific examples
- Evidence of framework components addressed
- Customer engagement beyond passive listening

---

#### 4-6 (Fair / Needs Improvement)
**Characteristics:**
- Basic framework elements present but lack depth
- Limited customer engagement or quantification
- Generic discovery without specific business impact
- Vague or minimal next steps
- Significant opportunities for improvement

**Example Evidence:**
"Asked about challenges, got vague response, showed features with limited customer connection, no quantification of impact, unclear next steps"

**What's Required:**
- Basic evidence that components were addressed
- May lack customer engagement or specificity
- Components present but execution needs work
- Clear gaps in framework application

---

#### 1-3 (Poor)
**Characteristics:**
- Framework elements largely missing or poorly executed
- No meaningful customer engagement or discovery
- Feature-dumping or rep-dominated conversation
- Customer passive or disengaged
- No business value established

**Example Evidence:**
"Rep monologue about product features, no discovery questions, customer provides one-word responses, no problems identified, no next steps discussed"

**What's Required:**
- Evidence of major framework gaps
- Lack of customer engagement
- Missing critical components
- No business value discussion

---

## Critical Scoring Principles

### 1. Score Based on Evidence Only
❌ **Wrong**: "This seems like it should be higher based on the company"
✅ **Right**: "Customer stated X, which demonstrates Y, score = Z"

### 2. Don't Artificially Boost Scores
❌ **Wrong**: "I don't want to be too harsh, so I'll give a 5 instead of 2"
✅ **Right**: "No discovery occurred, customer passive, score = 2"

### 3. Require Customer Engagement for High Scores (7+)
❌ **Wrong**: Rep statements alone justify score of 8
✅ **Right**: Customer quotes and validation required for 7+

### 4. Quantification Separates Good from Fair
- **Scores 7-8**: Some quantification (hours, costs, timelines)
- **Scores 4-6**: Vague or no quantification
- **Scores 9-10**: Specific, validated quantification with business impact

### 5. Use the Full Range - Poor Calls Exist
❌ **Wrong**: "Everyone gets at least a 4"
✅ **Right**: "This call deserves a 2 based on lack of framework execution"

### 6. Over-Scoring vs Under-Scoring

**Common Over-Scoring Mistakes:**
- Giving credit for rep statements without customer confirmation
- Scoring based on assumptions rather than evidence  
- Conflating product knowledge with framework execution
- Ignoring lack of customer engagement

**Common Under-Scoring Mistakes:**
- Requiring perfect framework language for high scores
- Penalizing natural conversation flow
- Missing subtle but effective framework application
- Requiring rigidity vs. recognizing good execution

---

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

---

## Quality Guidelines

1. **Evidence-based scoring**: Look for specific examples in the call content when available
2. **Use the full 1-10 range**: Don't cluster in the middle - spread scores authentically
3. **Methodology alignment**: {{methodologyGuidance}}
4. **Clear citations**: Reference specific moments or quotes when possible. Include Speaker Name and time of citation within the context of the call transcript
5. **Actionable recommendations**: Provide specific, implementable suggestions
6. **Be honest about poor performance**: If a call deserves a low score, give it that score

{{transcriptGuidance}}

---

## Scoring Decision Framework

**When in doubt, ask yourself:**

1. "What specific customer evidence supports this score?" (If none → lower score)
2. "Did the customer actively engage and validate?" (If no → score ≤6)
3. "Was there quantification and business impact?" (If no → score ≤6)
4. "Am I artificially boosting this score?" (If yes → use evidence-based score)
5. "Would a sales leader agree this score matches the evidence?" (If no → revise)

**Remember:**
- A score of 2-3 is not an insult - it's valuable feedback
- Accurate low scores enable targeted coaching
- The goal is improvement, not feeling good
- Your scoring helps identify what actually works

---

**CRITICAL**: Respond with ONLY the JSON object, no other text.