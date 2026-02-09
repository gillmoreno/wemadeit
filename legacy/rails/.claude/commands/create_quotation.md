---
description: Create a quotation from project requirements file
argument-hint: <organization_id> <file_path>
---

# Create Quotation from Requirements

Create a Deal and Quotation by analyzing project requirements from a TXT file.

## Your Task

1. Parse the arguments:
   - First argument: `organization_id` (required, numerical)
   - Second argument: `file_path` to TXT file (required)

2. Validate the organization exists using rails runner:
   ```bash
   rails runner "org = Organization.find($ORG_ID); puts org.to_json"
   ```
   If the organization doesn't exist, inform the user and stop.

3. Read the requirements file using the Read tool. The file should be a plain text file containing project requirements (may be in Italian).

4. Run the following rails runner script to generate and create the quotation. Replace the placeholders with actual values:

   ```bash
   rails runner "
   require 'json'

   # Configuration
   org_id = $ORG_ID
   requirements = <<~REQ
   $REQUIREMENTS_CONTENT
   REQ

   # Find organization
   org = Organization.find(org_id)
   puts \"Organization: #{org.name}\"

   # Get defaults
   pipeline = Pipeline.find_by(default: true) || Pipeline.first
   raise 'No pipeline found' unless pipeline

   stage = pipeline.pipeline_stages.order(:position).first
   raise 'No pipeline stages found' unless stage

   user = User.find_by(role: 0) || User.first # admin = 0
   raise 'No user found' unless user

   contact = org.contacts.find_by(primary_contact: true) || org.contacts.first
   raise \"Organization #{org.name} has no contacts. Please add a contact first.\" unless contact

   # Generate quotation using AI
   services = Service.where(active: true).to_a
   result = Ai::QuotationGenerator.new(requirements, organization: org, services: services).call

   unless result.success?
     puts \"Error generating quotation: #{result.error}\"
     exit 1
   end

   data = result.data
   puts \"\\nGenerated quotation data:\"
   puts JSON.pretty_generate(data)

   # Create Deal and Quotation in transaction
   ActiveRecord::Base.transaction do
     deal = Deal.create!(
       organization: org,
       contact: contact,
       pipeline_stage: stage,
       assigned_to: user,
       created_by: user,
       title: data['deal']['title'],
       description: data['deal']['description'],
       value: data['deal']['estimated_value'],
       currency: 'EUR',
       status: :open
     )

     quotation = Quotation.create!(
       deal: deal,
       created_by: user,
       title: data['quotation']['title'],
       introduction: data['quotation']['introduction'],
       tax_rate: 22.0,
       valid_until: 30.days.from_now,
       currency: 'EUR'
     )

     data['items'].each_with_index do |item, idx|
       quotation.quotation_items.create!(
         name: item['name'],
         description: item['description'],
         quantity: item['quantity'] || 1,
         unit_price: item['unit_price'],
         unit_type: item['unit_type'] || 'fixed',
         position: idx
       )
     end

     # Recalculate totals after adding items
     quotation.reload
     quotation.save!

     puts \"\\n\" + '=' * 50
     puts \"SUCCESS!\"
     puts '=' * 50
     puts \"Deal ##{deal.id}: #{deal.title}\"
     puts \"Quotation #{quotation.number}: #{quotation.title}\"
     puts \"Items: #{quotation.quotation_items.count}\"
     puts \"Subtotal: EUR #{quotation.subtotal}\"
     puts \"Tax (22%): EUR #{quotation.tax_amount}\"
     puts \"Total: EUR #{quotation.total}\"
     puts \"\\nView Deal: http://localhost:3000/crm/deals/#{deal.id}\"
     puts \"View Quotation: http://localhost:3000/quotations/#{quotation.id}\"
   end
   "
   ```

5. Display the results to the user, including links to view the created Deal and Quotation.

## Workflow Summary

1. Validate organization exists
2. Read requirements from TXT file
3. Call `Ai::QuotationGenerator` service to analyze requirements
4. Create Deal linked to organization
5. Create Quotation linked to Deal
6. Create QuotationItems from AI-generated line items
7. Show success summary with links

## Usage Examples

```
/create_quotation 1 /path/to/requirements.txt
```
Creates a deal and quotation for organization #1 from the TXT file.

```
/create_quotation 42 ~/Documents/progetto_scope.txt
```
Creates a deal and quotation for organization #42 from Italian requirements.

## Arguments

$ARGUMENTS
