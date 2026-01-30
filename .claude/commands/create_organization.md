---
description: Create an organization from a business image (Google Maps screenshot, business card, etc.)
argument-hint: <image_path>
---

# Create Organization from Business Image

Extract organization details from a business image and create the record in the CRM.

## Your Task

1. Parse the argument:
   - `image_path` (required): Path to the image file (PNG, JPG, etc.)

2. Read the image using the Read tool. Claude's multimodal vision will interpret the visual content directly — no OCR library is needed.

3. Extract as many of these fields as possible from the image:
   - `name` (required)
   - `industry`
   - `website`
   - `phone`
   - `email`
   - `billing_email`
   - `address`
   - `city`
   - `country`
   - `tax_id`
   - `notes`

   Only `name` is required. Omit any field that is not clearly present in the image — do not guess or fabricate values.

4. Run the following rails runner script to create the Organization. Replace placeholders with actual extracted values, and remove any lines for fields not found in the image:

   ```bash
   rails runner "
   org = Organization.create!(
     name: '$NAME',
     industry: '$INDUSTRY',
     website: '$WEBSITE',
     phone: '$PHONE',
     email: '$EMAIL',
     billing_email: '$BILLING_EMAIL',
     address: '$ADDRESS',
     city: '$CITY',
     country: '$COUNTRY',
     tax_id: '$TAX_ID',
     notes: '$NOTES'
   )
   puts '=' * 50
   puts 'SUCCESS!'
   puts '=' * 50
   puts \"Organization ##{org.id}: #{org.name}\"
   puts \"Industry: #{org.industry}\" if org.industry.present?
   puts \"Website: #{org.website}\" if org.website.present?
   puts \"Phone: #{org.phone}\" if org.phone.present?
   puts \"Email: #{org.email}\" if org.email.present?
   puts \"City: #{org.city}\" if org.city.present?
   puts \"Country: #{org.country}\" if org.country.present?
   puts ''
   puts \"View: http://localhost:3000/crm/organizations/#{org.id}\"
   "
   ```

   IMPORTANT: Escape single quotes and special characters in extracted values to avoid breaking the shell command. Use `'\''` to escape single quotes within the single-quoted strings.

5. Display the results to the user, including the link to view the organization in the CRM.

## Usage Examples

```
/create_organization /path/to/google_maps_screenshot.png
```
Creates an organization from a Google Maps business listing screenshot.

```
/create_organization ~/Desktop/business_card.jpg
```
Creates an organization from a photo of a business card.

## Arguments

$ARGUMENTS
