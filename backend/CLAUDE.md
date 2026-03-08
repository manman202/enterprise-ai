# Backend Development Rules

This directory contains the Enterprise AI backend services.

Claude acts as a backend engineering assistant.

## Languages

Primary languages:

- Python
- Node.js

## Architecture

Backend components include:

- API server
- AI orchestration layer
- RAG pipeline
- connectors
- authentication services

## Coding Standards

Claude should:

- write clear modular code
- add docstrings
- avoid unnecessary frameworks
- keep functions small
- follow existing project structure

## Dependencies

Claude may add dependencies only when necessary.

Preferred libraries:

Python:
- fastapi
- pydantic
- sqlalchemy

Node:
- express
- axios
- dotenv

## Security Rules

Claude must NEVER:

- commit secrets
- commit API keys
- hardcode credentials

Secrets must use:

.env files or environment variables.

## Testing

Claude should add:

- unit tests
- integration tests

Test frameworks:

Python → pytest  
Node → jest
