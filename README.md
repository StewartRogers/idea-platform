# Idea Platform

A platform for developing ideas through structured feedback, powered by AI-driven coaching. Users organize ideas into focus areas and challenges, and leverage a conversational AI coach to refine and develop their ideas.

## Features

- **Hierarchical Organization**: Organize ideas into Focus Areas → Challenges → Ideas
- **AI-Powered Coaching**: Real-time conversation with an AI coach that guides idea development
- **Structured Idea Framework**: Capture key aspects of ideas:
  - Idea name and description
  - Problem definition (what, who, and scale)
  - Potential benefits
  - Conversation history
- **Optional Authentication**: Basic HTTP auth for protecting your platform (configure via `AUTH_PASSWORD` in `.env`)
- **SQLite Database**: Persistent storage with WAL mode for reliability
- **REST API**: Full API for managing focus areas, challenges, and ideas

## Tech Stack

- **Backend**: Node.js + Express.js 5
- **Database**: SQLite 3 with better-sqlite3
- **Frontend**: JavaScript (75%), CSS (22%), HTML (3%)
- **AI**: Google Gemini API for coaching
- **Authentication**: Optional HTTP Basic Auth
- **Environment**: Dotenv for configuration

## Quick Start

### Prerequisites

- Node.js 16+
- npm
- Google Gemini API key ([get one here](https://aistudio.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/StewartRogers/idea-platform.git
   cd idea-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `PORT`: Server port (default: 3000)
   - `AUTH_PASSWORD`: (Optional) Password for basic auth

4. **Start the server**
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`

5. **Run tests**
   ```bash
   npm test
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | - | Google Gemini API key for AI coaching |
| `PORT` | No | 3000 | Server port |
| `AUTH_PASSWORD` | No | - | If set, enables HTTP Basic Auth with this password |

## API Reference

### Focus Areas

- `GET /api/focus-areas` - List all focus areas with challenge counts
- `GET /api/focus-areas/:id` - Get a specific focus area
- `POST /api/focus-areas` - Create a new focus area
- `PUT /api/focus-areas/:id` - Update a focus area
- `DELETE /api/focus-areas/:id` - Delete a focus area
- `GET /api/focus-areas/:id/challenges` - List challenges in a focus area
- `POST /api/focus-areas/:id/challenges` - Create a challenge in a focus area

### Challenges

- `GET /api/challenges/:id` - Get a specific challenge
- `PUT /api/challenges/:id` - Update a challenge
- `DELETE /api/challenges/:id` - Delete a challenge
- `GET /api/challenges/:id/ideas` - List ideas in a challenge
- `POST /api/challenges/:id/ideas` - Create an idea in a challenge

### Ideas

- `GET /api/ideas/:id` - Get a specific idea
- `PUT /api/ideas/:id` - Update idea fields (name, description, problem details, benefits)
- `DELETE /api/ideas/:id` - Delete an idea
- `PUT /api/ideas/:id/conversation` - Save conversation history
- `POST /api/ideas/:id/coach` - Stream AI coach response (Server-Sent Events)

### Coach Endpoint

The `/api/ideas/:id/coach` endpoint uses Server-Sent Events (SSE) for streaming responses:

```javascript
// Example request
const response = await fetch(`/api/ideas/${ideaId}/coach`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'I have an idea about...' })
});

// Stream the response
const reader = response.body.getReader();
// ... handle streaming text chunks
```

## Database Schema

### focus_areas
- `id` - Primary key
- `name` - Focus area name
- `description` - Optional description
- `created_at` - Timestamp

### challenges
- `id` - Primary key
- `focus_area_id` - Reference to focus_areas
- `name` - Challenge name
- `description` - Optional description
- `created_at` - Timestamp

### ideas
- `id` - Primary key
- `challenge_id` - Reference to challenges
- `name` - Idea name (optional)
- `description` - Idea description
- `problem_what` - What problem does it solve?
- `problem_who` - Who is affected?
- `problem_scale` - How significant/widespread?
- `benefits` - Potential benefits
- `conversation` - JSON array of conversation history
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Architecture

```
idea-platform/
├── server.js              # Express server setup
├── src/
│   ├── database.js        # SQLite initialization & schema
│   └── routes/
│       ├── focusAreas.js  # Focus areas endpoints
│       ├── challenges.js  # Challenges endpoints
│       ├── ideas.js       # Ideas endpoints
│       └── coach.js       # AI coaching endpoint
├── public/                # Frontend static files
├── tests/
│   └── api.test.js       # API tests
├── .env.example          # Example environment variables
└── package.json          # Dependencies & scripts
```

## Security

- **Optional Authentication**: Enable basic HTTP auth by setting `AUTH_PASSWORD`
- **Database Security**: Foreign key constraints enabled, WAL mode for crash recovery
- **Input Validation**: Request bodies validated before processing

## Development

### Project Structure

- **Backend**: Modular Express routes with separated concerns (database, routing, AI)
- **Frontend**: Static files served from `/public` with SPA fallback
- **Database**: Single SQLite file for easy deployment

### Adding New Features

1. Update database schema in `src/database.js` if needed
2. Create/modify routes in `src/routes/`
3. Add tests in `tests/`
4. Update frontend in `public/`

## License

MIT License - see [LICENSE](./LICENSE) file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on GitHub.
