# Liftuplabs Backend API

A comprehensive backend API for the Liftuplabs platform built with Node.js, Express, and MongoDB.

## Features

- **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (Student, Professional, Institution, Admin)
  - Password hashing with bcrypt
  - Profile management

- **Event Management**
  - Create, read, update, delete events
  - Event registration/unregistration
  - Advanced filtering and search
  - Event categories and tags
  - File uploads for event images

- **User Management**
  - User profiles with skills and preferences
  - Event hosting and participation tracking
  - Mentor/professional search
  - Admin dashboard with statistics

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system or use MongoDB Atlas.

5. **Run the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Events
- `GET /api/events` - Get all events (with filtering)
- `GET /api/events/:id` - Get single event
- `POST /api/events` - Create new event (authenticated)
- `PUT /api/events/:id` - Update event (organizer only)
- `DELETE /api/events/:id` - Delete event (organizer/admin only)
- `POST /api/events/:id/register` - Register for event
- `DELETE /api/events/:id/register` - Unregister from event
- `GET /api/events/my/hosted` - Get user's hosted events
- `GET /api/events/my/registered` - Get user's registered events

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID
- `GET /api/users/stats/dashboard` - Get dashboard statistics (admin)
- `PUT /api/users/:id/status` - Update user status (admin)
- `GET /api/users/search/mentors` - Search mentors/professionals

## Query Parameters

### Events Filtering
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `category` - Event category
- `mode` - Online/Offline/Hybrid
- `city` - Event city
- `search` - Search in title, description, tags
- `sort` - Sort by: latest, oldest, prize, deadline, participants
- `dateFrom` - Filter events from date
- `dateTo` - Filter events to date
- `minPrize` - Minimum prize amount

## Data Models

### User Schema
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: ['student', 'professional', 'institution', 'admin'],
  avatar: String,
  profile: {
    institution: String,
    city: String,
    skills: [String],
    bio: String,
    socialLinks: Object
  },
  registeredEvents: [EventRegistration],
  hostedEvents: [ObjectId],
  isEmailVerified: Boolean,
  isActive: Boolean
}
```

### Event Schema
```javascript
{
  title: String,
  description: String,
  organizer: {
    user: ObjectId,
    name: String,
    institution: String,
    contact: Object
  },
  category: String,
  type: String,
  mode: ['Online', 'Offline', 'Hybrid'],
  location: Object,
  dateTime: {
    start: Date,
    end: Date,
    timezone: String
  },
  registration: {
    deadline: Date,
    fee: Object,
    maxParticipants: Number,
    currentParticipants: Number,
    requirements: [String],
    teamSize: Object
  },
  prizes: [Prize],
  schedule: [ScheduleItem],
  tags: [String],
  skills: [String],
  participants: [Participant],
  status: ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
  faqs: [FAQ]
}
```

## Security Features

- **Helmet.js** - Security headers
- **Rate Limiting** - Prevent abuse
- **CORS** - Cross-origin resource sharing
- **Input Validation** - Express-validator
- **Password Hashing** - bcrypt
- **JWT Authentication** - Secure tokens

## Error Handling

The API uses consistent error response format:
```javascript
{
  success: false,
  message: "Error description",
  errors: [] // Validation errors if any
}
```

## Success Response Format

```javascript
{
  success: true,
  message: "Success message",
  data: {
    // Response data
  }
}
```

## Development

1. **Install nodemon for development**
   ```bash
   npm install -g nodemon
   ```

2. **Run in development mode**
   ```bash
   npm run dev
   ```

3. **Testing**
   ```bash
   npm test
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/liftuplabs |
| JWT_SECRET | JWT secret key | Required |
| JWT_EXPIRE | JWT expiration time | 7d |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.