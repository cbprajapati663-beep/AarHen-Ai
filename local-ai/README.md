# AarHen Local Model Profile

This folder contains an Ollama model profile for the general-purpose AarHen assistant.

## Requirements

- Ollama installed and running.
- The base model `qwen2.5:1.5b` already pulled locally.
- No cloud account, API key, subscription, or paid inference is required for this local profile.

## Build on Windows (PowerShell)

Run these commands from the repository root:

```powershell
ollama create aarhen-local -f .\\local-ai\\Modelfile
ollama run aarhen-local
```

If the terminal is currently inside an Ollama interactive session, type `/bye` and press Enter before running the commands in PowerShell.

## What this profile changes

- Gives the model AarHen's general-purpose identity and response rules.
- Keeps personal assistance, learning, research, coding, data analysis, and business support in scope.
- Treats Heritage Auto Finance as one optional specialist context, not AarHen's entire purpose.
- Adds clear honesty, privacy, approval, and STOP-related instructions.

## Important capability boundary

A Modelfile changes the model's instructions; it does **not** connect tools or implement capabilities. By itself it does not provide persistent memory, live web access, file access, voice, vision, computer control, or autonomous task execution. Those capabilities must be connected and enforced by the AarHen-AI host application. The profile explicitly instructs the model not to pretend otherwise.

The base model remains a small local model. Quality, speed, and supported context depend on the computer and Ollama runtime.
