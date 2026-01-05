# Create default pipeline with stages
pipeline = Pipeline.find_or_create_by!(name: "Sales Pipeline", default: true)

[
  { name: "Lead", position: 0, color: "#9CA3AF", probability: 10 },
  { name: "Qualified", position: 1, color: "#3B82F6", probability: 25 },
  { name: "Proposal", position: 2, color: "#8B5CF6", probability: 50 },
  { name: "Negotiation", position: 3, color: "#F59E0B", probability: 75 },
  { name: "Won", position: 4, color: "#10B981", probability: 100 },
  { name: "Lost", position: 5, color: "#EF4444", probability: 0 }
].each do |stage_attrs|
  pipeline.pipeline_stages.find_or_create_by!(name: stage_attrs[:name]) do |stage|
    stage.assign_attributes(stage_attrs)
  end
end

puts "Created pipeline with #{pipeline.pipeline_stages.count} stages"

# Create default services
[
  { name: "Discovery Workshop", code: "SVC-001", category: :consulting, unit_price: 1500, unit_type: "day", description: "Initial discovery and requirements gathering workshop" },
  { name: "UI/UX Design", code: "SVC-002", category: :design, unit_price: 800, unit_type: "day", description: "User interface and experience design" },
  { name: "Frontend Development", code: "SVC-003", category: :development, unit_price: 750, unit_type: "day", description: "Frontend implementation using modern frameworks" },
  { name: "Backend Development", code: "SVC-004", category: :development, unit_price: 800, unit_type: "day", description: "Backend API and database development" },
  { name: "Full-Stack Development", code: "SVC-005", category: :development, unit_price: 850, unit_type: "day", description: "End-to-end application development" },
  { name: "Monthly Support", code: "SVC-006", category: :support, unit_price: 500, unit_type: "month", description: "Ongoing maintenance and support" },
  { name: "Landing Page", code: "SVC-007", category: :development, unit_price: 2500, unit_type: "project", description: "Single-page marketing landing page" },
  { name: "E-commerce Setup", code: "SVC-008", category: :development, unit_price: 5000, unit_type: "project", description: "Basic e-commerce store setup" }
].each do |service_attrs|
  Service.find_or_create_by!(code: service_attrs[:code]) do |service|
    service.assign_attributes(service_attrs)
  end
end

puts "Created #{Service.count} services"

# Create default labels for tasks
[
  { name: "Bug", color: "#EF4444" },
  { name: "Feature", color: "#10B981" },
  { name: "Enhancement", color: "#3B82F6" },
  { name: "Documentation", color: "#8B5CF6" },
  { name: "Urgent", color: "#F59E0B" },
  { name: "Design", color: "#EC4899" }
].each do |label_attrs|
  Label.find_or_create_by!(name: label_attrs[:name]) do |label|
    label.color = label_attrs[:color]
  end
end

puts "Created #{Label.count} labels"

# Create admin user (only in development/test)
if Rails.env.development? || Rails.env.test?
  admin = User.find_or_create_by!(email_address: "admin@wemadeit.dev") do |user|
    user.password = "password123"
    user.name = "Admin User"
    user.role = :admin
  end

  sales = User.find_or_create_by!(email_address: "sales@wemadeit.dev") do |user|
    user.password = "password123"
    user.name = "Sales Person"
    user.role = :sales
  end

  pm = User.find_or_create_by!(email_address: "pm@wemadeit.dev") do |user|
    user.password = "password123"
    user.name = "Project Manager"
    user.role = :project_manager
  end

  dev = User.find_or_create_by!(email_address: "dev@wemadeit.dev") do |user|
    user.password = "password123"
    user.name = "Developer"
    user.role = :developer
  end

  puts "Created #{User.count} users"
  puts "Admin login: admin@wemadeit.dev / password123"
end
