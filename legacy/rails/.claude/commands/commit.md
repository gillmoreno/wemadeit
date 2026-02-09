---
allowed-tools: ["Bash", "Read", "Edit", "Write"]
model: "claude-haiku-4-5"
description: "Create a git commit following Gil's preferred format"
---

Create a git commit with the following format:

1. First, analyze the changes by running `git status` and `git diff`
2. Stage all modified files using `git add`
3. Create a commit message that follows this exact format:
   - Start with square brackets containing 1-3 words describing the changes (e.g., [bugfix], [new feature], [refactor], [update config])
   - Add a line break
   - List the relevant changes as bullet points with "+" symbol
   - Keep the list concise - 1 to 3 items maximum
   - Focus on the most important changes

Example commit message format:

```
[config update]
+ Added color configuration for logger levels
+ Set bold formatting for all log outputs
```

Another example:

```
[bugfix]
+ Fixed edge labeling for hem detection
+ Corrected waistband measurement units
```

Execute the commit with this formatted message.
