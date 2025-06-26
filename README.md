# GamEaten 🎮

**GamEaten** is a comprehensive social platform designed specifically for the gaming community, enabling users to discover, share, and engage with authentic game reviews in an intuitive and organized environment.

## 🌟 Overview

While general social platforms and game marketplaces offer rating systems, there wasn't a dedicated space for gamers to share detailed, personalized reviews and connect with others who share similar gaming tastes. GamEaten bridges this gap by creating a specialized platform that puts the gaming experience at the center.

## ✨ Key Features

### 🎯 Smart Game Discovery
- **IGDB API Integration**: Comprehensive game database with detailed information
- **Advanced Search**: Find games by title, genre, platform, and more
- **Game Suggestions**: Personalized recommendations based on user preferences

### 💬 Social Review System
- **Rich Reviews**: Write detailed reviews with text and GIF support
- **Interactive Engagement**: Like, comment, and repost reviews
- **Nested Comments**: Threaded discussions on reviews
- **Media Integration**: Giphy API for enhanced expressions

### 👥 Community Features
- **Follow System**: Connect with other gamers
- **Personalized Feed**: See reviews from followed users and preferred genres
- **User Profiles**: Customizable profiles with photo uploads
- **Saved Games**: Bookmark games for later

### 🔐 User Management
- **JWT Authentication**: Secure login system
- **Profile Customization**: Upload profile photos and manage settings
- **Password Management**: Secure password changes and validation

## 🛠️ Tech Stack

### Frontend
- **React 19** with **TypeScript** for type-safe development
- **Vite** for fast build tool and development server
- **Material-UI** for consistent component design
- **SCSS/Sass** for custom styling
- **FontAwesome** for icons
- **Axios** for API communication
- **React Router** for navigation

### Backend
- **Python** with **Flask** framework
- **SQLAlchemy** ORM for database management
- **MySQL** database with optimized indexes
- **JWT** for authentication
- **bcrypt** for password hashing
- **Flask-CORS** for cross-origin requests

### External APIs
- **IGDB API** for comprehensive game data
- **Giphy API** for GIF integration in reviews and comments

### DevOps & Deployment
- **Docker** & **Docker Compose** for containerization
- **Nginx** for frontend serving
- **Gunicorn** for Python WSGI server
- **GitHub Container Registry** for image hosting

## 🚀 Getting Started

### 🌐 Live Demo
**Try GamEaten now:** [https://gameaten.terboro.com/](https://gameaten.terboro.com/)

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.8+ (for local development)

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/GamEaten.git
   cd GamEaten
   ```

2. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   GIPHY_API_KEY=your_giphy_api_key
   IGDB_CLIENT=your_igdb_client_id
   IGDB_SECRET=your_igdb_client_secret
   CLIENT_SECRET=your_jwt_client_secret
   SECRET_KEY=your_flask_secret_key
   ```

### Quick Start with Docker

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **Access the application**
   - **Live Demo**: [https://gameaten.terboro.com/](https://gameaten.terboro.com/)
   - Frontend (local): http://localhost
   - Backend API (local): http://localhost:5000

### Local Development

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
GamEaten/
├── backend/                # Flask API server
│   ├── app.py             # Main Flask application
│   ├── funcs.py           # Utility functions
│   ├── requirements.txt   # Python dependencies
│   └── uploads/           # User uploaded files
├── frontend/              # React application
│   ├── src/
│   │   ├── api/          # API communication layer
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts
│   │   ├── pages/        # Application pages
│   │   └── styles/       # SCSS stylesheets
│   ├── package.json      # Node.js dependencies
│   └── vite.config.ts    # Vite configuration
├── docker-compose.yml     # Multi-container setup
└── README.md
```

## 🎯 Next Steps & Roadmap

### 🔄 Immediate Improvements

#### 1. **Enhanced User Experience - Guest Browsing** 🚀
- **Objective**: Allow users to browse and view content before logging in
- **Implementation**: 
  - Modify authentication middleware to allow read-only access
  - Show login/register prompts for interactive features (like, comment, follow)
  - Implement preview mode similar to Twitter/Instagram
  - Add "Sign up to interact" overlays on action buttons

#### 2. **Performance Optimizations**
- Implement infinite scrolling for feeds
- Add image lazy loading
- Optimize database queries with better indexing
- Cache frequently accessed game data

#### 3. **Mobile Responsiveness**
- Improve mobile UI/UX design
- Add touch gestures for navigation
- Optimize for different screen sizes

### 🔮 Future Features

#### 4. **Enhanced Social Features**
- **User Mentions**: @ referencing system to tag users in reviews and comments
- **Direct Messaging**: Private conversations between users
- **Game Collections**: Create and share curated game lists
- **Review Ratings**: Star ratings alongside text reviews
- **User Badges**: Achievement system for active reviewers

#### 5. **Content & Discovery**
- **Game News Integration**: Latest gaming news and updates
- **Review Analytics**: Insights for popular reviews and games
- **Advanced Filtering**: Filter by rating, date, platform, etc.
- **Trending Games**: Most reviewed and discussed games

#### 6. **Community Building**
- **Gaming Groups**: Create communities around specific games/genres
- **Events**: Gaming events and tournaments
- **Leaderboards**: Most active reviewers, top-rated games
- **Review Contests**: Monthly/weekly review competitions

#### 7. **Technical Enhancements**
- **Real-time Notifications**: WebSocket implementation
- **Advanced Search**: Elasticsearch integration
- **API Rate Limiting**: Implement proper rate limiting
- **Monitoring**: Add logging and analytics
- **Testing**: Comprehensive test suite (unit, integration, e2e)

## 🤝 Contributing

This project was developed as part of a Software Engineering Lab course with a 4-person team using agile methodologies. Contributions focused on:

- API design and backend development
- User authentication and security
- Social features implementation
- Docker deployment configuration
- Frontend component development

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **🌐 Live Demo**: [https://gameaten.terboro.com/](https://gameaten.terboro.com/)
- **📚 Documentation**: This README
- **🐳 Docker Images**: GitHub Container Registry

## 🎮 Built by Gamers, for Gamers

GamEaten aims to become the go-to destination for authentic gaming reviews, helping players make informed decisions while building a vibrant community of gaming enthusiasts.

**Experience GamEaten live at: [gameaten.terboro.com](https://gameaten.terboro.com/)**

---

**Happy Gaming! 🎮✨**