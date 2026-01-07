---
description: Clean a transcript and save to CRM interaction
argument-hint: <interaction_id> [transcript_text]
---

# Clean Transcript

Clean a messy transcript using AI with full CRM context and save it directly to the database.

## Your Task

1. Parse the arguments:
   - First argument: interaction_id (required)
   - Remaining text: optional inline transcript

2. Fetch the interaction from the database:
   ```bash
   rails runner "puts Interaction.find($ARGUMENTS.split.first).to_json"
   ```

3. If no inline transcript provided, use the stored transcript from the interaction

4. Gather CRM context by reading the interaction's related records:
   - Contact name and email
   - Organization name and industry
   - Deal title, value, and status
   - Last 5 related interactions (summaries)

5. Call the AI endpoint to clean the transcript:
   ```bash
   curl -X POST http://localhost:3000/ai/clean_transcript \
     -H "Content-Type: application/json" \
     -d '{"interaction_id": ID, "transcript": "optional transcript text"}'
   ```

   Or use rails runner for direct database access:
   ```ruby
   interaction = Interaction.find(ID)
   result = Ai::TranscriptCleaner.new(
     transcript_text,
     crm_context: interaction.crm_context
   ).call

   if result.success?
     interaction.update!(cleaned_transcript: result.data)
     puts "Transcript cleaned and saved!"
     puts result.data
   else
     puts "Error: #{result.error}"
   end
   ```

6. Display the cleaned transcript to the user

## Usage Examples

```
/clean-transcript 123
```
Uses the transcript already stored in interaction #123

```
/clean-transcript 123 "Ehm allora, il cliente ha detto che... um... vuole il progetto entro marzo"
```
Cleans the provided transcript and saves to interaction #123

## Arguments

$ARGUMENTS
