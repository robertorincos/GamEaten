from flask import Flask, request, jsonify, make_response, request, render_template, session, flash, send_from_directory
import requests
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, Index
import json
from os import urandom
import bcrypt
from funcs import *
import os
from dotenv import load_dotenv, set_key
import jwt
from email_validator import EmailNotValidError, validate_email 
from flask_cors import CORS
import html
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import uuid

app = Flask(__name__)
CORS(app)

# Only load .env file if not in production (when FLASK_ENV is not 'production')
if os.getenv('FLASK_ENV') != 'production':
    load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = f'{os.getenv("DB_URI")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', os.getenv('secret'))  # Fallback to 'secret' for backward compatibility

# Upload configuration
UPLOAD_FOLDER = 'uploads/profile_photos'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB (increased since no processing)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# Games cache table - to store game information locally
class Games(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # IGDB game ID
    name = db.Column(db.String(255), nullable=False, index=True)
    summary = db.Column(db.Text, nullable=True)
    rating = db.Column(db.Float, nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)
    release_date = db.Column(db.String(100), nullable=True)
    platforms = db.Column(db.Text, nullable=True)  # JSON string of platforms
    artwork_urls = db.Column(db.Text, nullable=True)  # JSON string of artwork URLs
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    reviews = db.relationship('Reviews', backref='game_info', lazy='dynamic')
    
    def __repr__(self):
        return f'<Game {self.id}: {self.name}>'
    
    def to_dict(self):
        platforms_list = []
        artwork_list = []
        
        try:
            if self.platforms:
                platforms_list = json.loads(self.platforms)
        except (json.JSONDecodeError, TypeError):
            platforms_list = []
        
        try:
            if self.artwork_urls:
                artwork_list = json.loads(self.artwork_urls)
        except (json.JSONDecodeError, TypeError):
            artwork_list = []
            
        return {
            'id': self.id,
            'name': self.name,
            'summary': self.summary,
            'rating': self.rating,
            'cover_url': self.cover_url,
            'release_date': self.release_date,
            'platforms': platforms_list,
            'artwork_urls': artwork_list,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }
    
    @staticmethod
    def should_refresh(game_record):
        """Check if game data should be refreshed (older than 7 days)"""
        if not game_record or not game_record.last_updated:
            return True
        return datetime.utcnow() - game_record.last_updated > timedelta(days=7)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), unique=False, nullable=False)
    profile_photo = db.Column(db.String(255), nullable=True)  # Store filename of uploaded photo
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Follow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    following_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure a user can't follow the same person twice
    __table_args__ = (db.UniqueConstraint('follower_id', 'following_id', name='unique_follow'),)
    
    def __repr__(self):
        return f'<Follow {self.follower_id} -> {self.following_id}>'

# Reviews table - optimized with game caching
class Reviews(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    id_game = db.Column(db.Integer, db.ForeignKey('games.id'), nullable=False, index=True)
    username = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    review_text = db.Column(db.String(255), unique=False, nullable=True)
    gif_url = db.Column(db.String(500), unique=False, nullable=True)
    date_created = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = db.relationship('User', backref='user_reviews')
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_game_date', 'id_game', 'date_created'),
        Index('idx_user_date', 'username', 'date_created'),
    )
    
    def __repr__(self):
        return f'<Review {self.id}>'

    def to_dict(self, current_user_id=None, include_game_info=True):
        # Get the actual username from the User model
        user = User.query.get(self.username)
        display_username = user.username if user else f"User {self.username}"
        profile_photo = None
        if user and user.profile_photo:
            profile_photo = f'/api/profile/photo/{user.profile_photo}'
        
        # Get comment count for this review
        comment_count = Comments.query.filter_by(review_id=self.id).count()
        
        # Get likes count for this review
        likes_count = Likes.query.filter_by(review_id=self.id).count()
        
        # Get reposts count for this review
        reposts_count = Reposts.query.filter_by(review_id=self.id).count()
        
        # Check if current user has liked this review
        user_has_liked = False
        if current_user_id:
            user_has_liked = Likes.query.filter_by(
                review_id=self.id, 
                user_id=current_user_id
            ).first() is not None
        
        # Check if current user has reposted this review
        user_has_reposted = False
        if current_user_id:
            user_has_reposted = Reposts.query.filter_by(
                review_id=self.id,
                user_id=current_user_id
            ).first() is not None
        
        result = {
            "id": self.id, 
            "id_game": self.id_game, 
            "user_id": self.username,
            "username": display_username,
            "profile_photo": profile_photo,
            "review_text": self.review_text if self.review_text else "",
            "gif_url": self.gif_url,
            "has_text": bool(self.review_text and self.review_text.strip()),
            "has_gif": bool(self.gif_url),
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S'),
            "comment_count": comment_count,
            "likes_count": likes_count,
            "reposts_count": reposts_count,
            "user_has_liked": user_has_liked,
            "user_has_reposted": user_has_reposted
        }
        
        # Include cached game information if requested
        if include_game_info:
            # Try to get from relationship first
            game_info = None
            if hasattr(self, 'game_info') and self.game_info:
                game_info = self.game_info.to_dict()
            else:
                # Fallback: Get from Games table directly
                game_record = Games.query.get(self.id_game)
                if game_record:
                    game_info = game_record.to_dict()
            
            if game_info:
                result["game_info"] = game_info
        
        return result

# Likes table - for review likes
class Likes(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Ensure a user can't like the same review twice
    __table_args__ = (db.UniqueConstraint('user_id', 'review_id', name='unique_like'),)
    
    def __repr__(self):
        return f'<Like {self.user_id} -> Review {self.review_id}>'

# Comments table - actual comments on reviews
class Comments(db.Model):
    comment_id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.comment_id'), nullable=True)  # For nested comments
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False)  # What review this comment belongs to
    username = db.Column(db.String(80), unique=False, nullable=False)
    comment = db.Column(db.String(255), unique=False, nullable=True)  # Allow null for GIF-only comments
    gif_url = db.Column(db.String(500), unique=False, nullable=True)  # For GIF URLs
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Self-referential relationship for nested comments
    parent = db.relationship('Comments', remote_side=[comment_id], backref='replies')
    
    def __repr__(self):
        return f'<Comment {self.comment_id}>'

    def to_dict(self):
        # Get the actual username from the User model
        user = User.query.filter_by(id=self.username).first()
        display_username = user.username if user else f"User {self.username}"
        profile_photo = None
        if user and user.profile_photo:
            profile_photo = f'/api/profile/photo/{user.profile_photo}'
        
        return {
            "comment_id": self.comment_id,
            "parent_id": self.parent_id,
            "review_id": self.review_id,
            "user_id": self.username,  # Keep the original ID for reference
            "username": display_username,  # Add the actual username
            "profile_photo": profile_photo,
            "comment": self.comment if self.comment else "",  # Handle null comments
            "gif_url": self.gif_url,
            "has_text": bool(self.comment and self.comment.strip()),
            "has_gif": bool(self.gif_url),
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S'),
            "reply_count": len(self.replies) if hasattr(self, 'replies') else 0
        }

# Reposts table - for Twitter-like reposts of reviews
class Reposts(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    review_id = db.Column(db.Integer, db.ForeignKey('reviews.id'), nullable=False, index=True)
    repost_text = db.Column(db.String(255), unique=False, nullable=True)  # Optional text to add to repost
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='reposts')
    review = db.relationship('Reviews', backref='reposts')
    
    # Ensure a user can't repost the same review twice
    __table_args__ = (db.UniqueConstraint('user_id', 'review_id', name='unique_repost'),)
    
    def __repr__(self):
        return f'<Repost {self.user_id} -> Review {self.review_id}>'

    def to_dict(self, current_user_id=None):
        # Get the user info for the reposter
        user = User.query.filter_by(id=self.user_id).first()
        reposter_username = user.username if user else f"User {self.user_id}"
        reposter_profile_photo = None
        if user and user.profile_photo:
            reposter_profile_photo = f'/api/profile/photo/{user.profile_photo}'
        
        # Get the original review data
        original_review = self.review.to_dict(current_user_id) if self.review else None
        
        # Get repost count for this review
        repost_count = Reposts.query.filter_by(review_id=self.review_id).count()
        
        # Check if current user has reposted this review
        user_has_reposted = False
        if current_user_id:
            user_has_reposted = Reposts.query.filter_by(
                review_id=self.review_id,
                user_id=current_user_id
            ).first() is not None
        
        return {
            "id": self.id,
            "type": "repost",  # Identifier to distinguish from regular reviews
            "user_id": self.user_id,
            "username": reposter_username,
            "profile_photo": reposter_profile_photo,
            "repost_text": self.repost_text,
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "original_review": original_review,
            "repost_count": repost_count,
            "user_has_reposted": user_has_reposted
        }

# Saved Games table - for users to save games to their profile
class SavedGames(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    game_id = db.Column(db.Integer, db.ForeignKey('games.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='saved_games')
    game = db.relationship('Games', backref='saved_by_users')
    
    # Ensure a user can't save the same game twice
    __table_args__ = (db.UniqueConstraint('user_id', 'game_id', name='unique_saved_game'),)
    
    def __repr__(self):
        return f'<SavedGame {self.user_id} -> Game {self.game_id}>'

    def to_dict(self):
        game_info = self.game.to_dict() if self.game else None
        return {
            "id": self.id,
            "user_id": self.user_id,
            "game_id": self.game_id,
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "game_info": game_info
        }

@app.route('/api/search', methods=['POST'])
def search():
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
    
    if 'query' not in request.json or not request.json['query']:
        return jsonify({"status": "Search query is required"}), 400
    
    name = request.json['query']
    
    if len(name) > 100:  
        return jsonify({"status": "Query too long"}), 400
        
    sanitized_name = name.replace('"', '')
    
    try:
        t = check_token()
        token = t.json()['access_token']
        headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization':f'Bearer {token}'}
        body = f'fields *; search "{sanitized_name}";'
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        result = response.json()
        
        if not result:
            return jsonify({"status": "No games found"}), 404
            
        if 'id' in result[0]:
            return jsonify(result[0]['id']), 200
        else:
            return jsonify({"status": "ID not found in response"}), 500
    
    except Exception as e:
        return jsonify({"status": f"An error occurred: {str(e)}"}), 500

@app.route('/api/game', methods=['GET', 'POST'])
def game():
    try:
        # Get the ID value from the request (JSON body for POST or query params for GET)
        id_value = None
        
        if request.method == 'POST':
            if not request.is_json:
                return jsonify({"status": "JSON request expected"}), 400
                
            if 'id' not in request.json:
                return jsonify({"status": "ID is required"}), 400
                
            id_value = request.json['id']
        elif request.method == 'GET':
            if 'id' not in request.args:
                return jsonify({"status": "ID is required"}), 400
                
            id_value = request.args.get('id')

        if not isinstance(id_value, (int, str)):
            return jsonify({"status": "ID must be an integer or string convertible to integer"}), 400

        if isinstance(id_value, str):
            if not id_value.isdigit():
                return jsonify({"status": "ID must contain only digits"}), 400
            id_value = int(id_value)

        if id_value <= 0 or id_value > 1000000000:
            return jsonify({"status": "ID out of acceptable range"}), 400
        
        # Try to get from cache first
        cached_game = Games.query.get(id_value)
        
        if cached_game and not Games.should_refresh(cached_game):
            # Return cached data in IGDB format for backward compatibility
            game_dict = cached_game.to_dict()
            
            # Convert to IGDB API format
            result = [{
                'id': game_dict['id'],
                'name': game_dict['name'],
                'summary': game_dict['summary'],
                'rating': game_dict['rating'],
                'cover': {'url': game_dict['cover_url']} if game_dict['cover_url'] else None,
                'artworks': [{'url': url} for url in game_dict['artwork_urls']] if game_dict['artwork_urls'] else [],
                'platforms': game_dict['platforms'] if game_dict['platforms'] else [],
                'release_dates': [{'human': game_dict['release_date']}] if game_dict['release_date'] else []
            }]
            
            return jsonify(result), 200
        
        # Fetch from IGDB and cache
        game_data = fetch_game_from_igdb(id_value)
        if not game_data:
            return jsonify({"status": "Game not found"}), 404
        
        # Cache the game data
        cache_game_info(db, Games, game_data)
        
        # Return in IGDB format
        platforms = json.loads(game_data['platforms']) if game_data['platforms'] else []
        artworks = [{'url': url} for url in json.loads(game_data['artwork_urls'])] if game_data['artwork_urls'] else []
        
        result = [{
            'id': game_data['id'],
            'name': game_data['name'],
            'summary': game_data['summary'],
            'rating': game_data['rating'],
            'cover': {'url': game_data['cover_url']} if game_data['cover_url'] else None,
            'artworks': artworks,
            'platforms': platforms,
            'release_dates': [{'human': game_data['release_date']}] if game_data['release_date'] else []
        }]
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({"status": f"Invalid ID format: {str(e)}"}), 400
    except Exception as e:
        print(f"Error in /game route: {str(e)}")
        return jsonify({"status": "An error occurred processing your request"}), 500

@app.route('/api/games/bulk', methods=['POST'])
def bulk_games():
    """
    Fetch multiple games efficiently using cache-first approach
    Accepts: {"game_ids": [1, 2, 3, ...]}
    Returns: {"games": {1: {...}, 2: {...}, ...}}
    """
    try:
        if not request.is_json:
            return jsonify({"status": "JSON request expected"}), 400
        
        if 'game_ids' not in request.json:
            return jsonify({"status": "game_ids array is required"}), 400
        
        game_ids = request.json['game_ids']
        
        if not isinstance(game_ids, list):
            return jsonify({"status": "game_ids must be an array"}), 400
        
        if len(game_ids) > 50:  # Limit to prevent abuse
            return jsonify({"status": "Maximum 50 games per request"}), 400
        
        # Validate all IDs
        validated_ids = []
        for game_id in game_ids:
            try:
                validated_id = int(game_id)
                if validated_id > 0:
                    validated_ids.append(validated_id)
            except (ValueError, TypeError):
                continue
        
        if not validated_ids:
            return jsonify({"games": {}}), 200
        
        # Get games from cache or fetch from IGDB
        cached_games = get_or_cache_games(db, Games, validated_ids)
        
        # Format response
        games_data = {}
        for game_id, game_record in cached_games.items():
            if game_record:
                games_data[game_id] = {
                    'id': game_record.id,
                    'name': game_record.name,
                    'cover_url': game_record.cover_url,
                    'rating': game_record.rating
                }
        
        return jsonify({"games": games_data}), 200
        
    except Exception as e:
        print(f"Error in bulk games route: {str(e)}")
        return jsonify({"status": "An error occurred processing your request"}), 500

@app.route('/api/register', methods=['POST'])
def register():
    info = request.json
    password = request.json['pass']
    if len(password) >= 8:
        hashed_password_bytes = hash_password(info['pass'])
        hashed_password = hashed_password_bytes.decode('utf-8')
        info.update({'pass' : hashed_password})
        email = request.json['email']
        try:
            valid = validate_email(email)
            email = valid.email
            user = request.json['user']
            
            email_exists = User.query.filter_by(email=email).first()
            if email_exists:
                return jsonify({"status": "Email already registered"}), 400
            
            username_exists = User.query.filter_by(username=user).first()
            if username_exists:
                return jsonify({"status": "Username already taken"}), 400
                
            new_user = User(username=user, email=email, password=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            info.pop('pass')
            return info, 201
        except EmailNotValidError as e:
            return jsonify({"status": f"Invalid email: {str(e)}"}), 400
    else:
        return jsonify({"status": "Password must be at least 8 characters long"}), 400

@app.route('/api/login', methods=['POST'])
def login():
    password = request.json['pass']
    email = request.json['email']
    
    try:
        valid = validate_email(email)
        email = valid.email  # Email normalizado
    except EmailNotValidError as e:
        return jsonify({'status': f'Invalid email format: {str(e)}'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password, passworddb):
            token = jwt.encode({
                'user': user.id,
                'exp': datetime.utcnow() + timedelta(days=7)
            }, app.config['SECRET_KEY'], algorithm="HS256")
            
            return jsonify({
                'status': 'success',
                'token': token.decode('utf-8') if isinstance(token, bytes) else token
            }), 200
        else:
            return jsonify({'status': 'password wrong'}), 400
    else:
        return jsonify({'status': 'email not found'}), 404

@app.route('/api/change-password', methods=['POST'])
@token_required
def change_password():

    id = request.token_data['user']
    
    if not request.is_json or 'new' not in request.json:
        return jsonify({'status': 'New password required'}), 400
    
    user = User.query.filter_by(id=id).first()
    if not user:
        return jsonify({'status': 'User not found'}), 404

    if 'current_pass' in request.json:
        current_password = request.json['current_pass']
        passworddb = user.password.encode('utf-8')
        if not verify_password(current_password, passworddb):
            return jsonify({'status': 'Current password incorrect'}), 403
    
    new_password = request.json['new']
    hashed_password_bytes = hash_password(new_password)
    hashed_password = hashed_password_bytes.decode('utf-8')
    
    user.password = hashed_password
    db.session.commit()
    
    return jsonify({'status': 'password changed'}), 200 

@app.route('/api/user', methods=['POST'])
@token_required
def user():
    id = request.token_data['user']
    user = User.query.filter_by(id=id).first()
    if user:
        return jsonify({
            'status': user.username,
            'user': {
                'id': user.id,
                'username': user.username,
                'profile_photo': f'/api/profile/photo/{user.profile_photo}' if user.profile_photo else None,
                'join_date': user.created_at.strftime('%Y-%m-%d') if user.created_at else None
            }
        }), 200
    else:
        return jsonify({'status': 'User not found'}), 404

@app.route('/api/user/<username>', methods=['GET'])
@token_required
def get_user_profile(username):
    """Get user profile by username"""
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'status': 'User not found'}), 404
    
    # Get follower and following counts
    follower_count = Follow.query.filter_by(following_id=user.id).count()
    following_count = Follow.query.filter_by(follower_id=user.id).count()
    
    # Check if current user is following this user
    current_user_id = request.token_data['user']
    is_following = Follow.query.filter_by(
        follower_id=current_user_id, 
        following_id=user.id
    ).first() is not None
      # Get user's review count (renamed from comment_count)
    review_count = Reviews.query.filter_by(username=str(user.id)).count()
    
    return jsonify({
        'status': 'success',
        'user': {
            'id': user.id,
            'username': user.username,
            'follower_count': follower_count,
            'following_count': following_count,
            'review_count': review_count,
            'comment_count': review_count,  # Keep the same key for backward compatibility
            'is_following': is_following,
            'is_own_profile': current_user_id == user.id,
            'profile_photo': f'/api/profile/photo/{user.profile_photo}' if user.profile_photo else None,
            'join_date': user.created_at.strftime('%Y-%m-%d') if user.created_at else None
        }
    }), 200

@app.route('/api/follow', methods=['POST'])
@token_required
def follow_user():
    """Follow or unfollow a user"""
    if not request.is_json or 'username' not in request.json:
        return jsonify({'status': 'Username is required'}), 400
    
    target_username = request.json['username']
    follower_id = request.token_data['user']
    
    # Find the target user
    target_user = User.query.filter_by(username=target_username).first()
    if not target_user:
        return jsonify({'status': 'User not found'}), 404
    
    # Can't follow yourself
    if follower_id == target_user.id:
        return jsonify({'status': 'Cannot follow yourself'}), 400
    
    # Check if already following
    existing_follow = Follow.query.filter_by(
        follower_id=follower_id,
        following_id=target_user.id
    ).first()
    
    if existing_follow:
        # Unfollow
        db.session.delete(existing_follow)
        db.session.commit()
        return jsonify({'status': 'unfollowed', 'is_following': False}), 200
    else:
        # Follow
        new_follow = Follow(follower_id=follower_id, following_id=target_user.id)
        db.session.add(new_follow)
        db.session.commit()
        return jsonify({'status': 'followed', 'is_following': True}), 200

@app.route('/api/user/<username>/followers', methods=['GET'])
@token_required
def get_user_followers(username):
    """Get list of users following this user"""
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'status': 'User not found'}), 404
    
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    
    followers_query = db.session.query(User).join(
        Follow, User.id == Follow.follower_id
    ).filter(Follow.following_id == user.id)
    
    total_followers = followers_query.count()
    followers = followers_query.offset((page - 1) * size).limit(size).all()
    
    followers_list = [{
        'id': follower.id,
        'username': follower.username
    } for follower in followers]
    
    return jsonify({
        'status': 'success',
        'followers': followers_list,
        'pagination': {
            'total': total_followers,
            'pages': (total_followers + size - 1) // size,
            'current_page': page,
            'per_page': size
        }
    }), 200

@app.route('/api/user/<username>/following', methods=['GET'])
@token_required
def get_user_following(username):
    """Get list of users this user is following"""
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'status': 'User not found'}), 404
    
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    
    following_query = db.session.query(User).join(
        Follow, User.id == Follow.following_id
    ).filter(Follow.follower_id == user.id)
    
    total_following = following_query.count()
    following = following_query.offset((page - 1) * size).limit(size).all()
    
    following_list = [{
        'id': user_following.id,
        'username': user_following.username
    } for user_following in following]
    
    return jsonify({
        'status': 'success',
        'following': following_list,
        'pagination': {
            'total': total_following,
            'pages': (total_following + size - 1) // size,
            'current_page': page,
            'per_page': size
        }
    }), 200
    
# cria um comentario
# @app.route('/comment', methods=['POST'])
# @token_required
# def comment():
#     id = request.token_data['user']
#     id_game = request.json['id_game']
#     commented = request.json['comment']
#     new_comment = Comments(username=id, id_game=id_game, Comment=commented)
#     db.session.add(new_comment)
#     db.session.commit()
#     return {'status': 'comentario criado'}, 200

@app.route('/api/comment/<int:id>', methods=['PUT'])
@token_required
def edit(id):
    user_id = request.token_data['user']
    comment = Comments.query.get_or_404(id)
    
    if str(comment.username) != str(user_id):
        return jsonify({"status": "Unauthorized - you can only edit your own comments"}), 403
    
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
      # Get new comment text and GIF URL
    new_comment_text = request.json.get('comment', '').strip() if 'comment' in request.json else comment.comment
    new_gif_url = request.json.get('gif_url', '').strip() if 'gif_url' in request.json else comment.gif_url
    
    # Handle explicit removal of text or GIF
    if 'comment' in request.json and not new_comment_text:
        new_comment_text = None
    if 'gif_url' in request.json and not new_gif_url:
        new_gif_url = None
    
    # Validate that we have either text or GIF (or both)
    if not new_comment_text and not new_gif_url:
        return jsonify({"status": "Either comment text or GIF URL is required"}), 400
    
    # Validate text comment if provided
    if new_comment_text:
        if len(new_comment_text) > 255:
            return jsonify({"status": "Comment too long (max 255 characters)"}), 400
        new_comment_text = html.escape(new_comment_text)
    
    # Validate GIF URL if provided
    if new_gif_url:
        if not is_valid_gif_url(new_gif_url):
            return jsonify({"status": "Invalid GIF URL"}), 400
    
    try:
        comment.Comment = new_comment_text
        comment.gif_url = new_gif_url
        db.session.commit()
        
        return jsonify({
            "status": "comentario atualizado",
            "comment": comment.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error updating comment: {str(e)}"}), 500

# remover um comentario feito por voce
@app.route('/api/comment/<int:id>', methods=['DELETE'])
@token_required
def delete(id):
    #apenas o criador deletar
    comment = Comments.query.get_or_404(id)
    db.session.delete(comment)
    db.session.commit()
    return {"status":"comentario deletado"}, 200


# Create a new review (what was previously called comment)
@app.route('/api/review', methods=['POST'])
@token_required
def create_review():
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
        
    # Verificar campos obrigatórios
    required_fields = ['id_game']
    for field in required_fields:
        if field not in request.json or not request.json[field]:
            return jsonify({"status": f"Field '{field}' is required"}), 400
    
    user_id = request.token_data['user']
    
    # Validar e converter id_game
    try:
        id_game = int(request.json['id_game'])
        if id_game <= 0:
            return jsonify({"status": "Game ID must be positive"}), 400
    except ValueError:
        return jsonify({"status": "Game ID must be an integer"}), 400
    
    # Ensure game exists in cache - fetch if needed
    game_cache = get_or_cache_games(db, Games, [id_game])
    if id_game not in game_cache:
        return jsonify({"status": "Game not found"}), 404
    
    # Get review text and GIF URL
    review_text = request.json.get('review_text', request.json.get('comment', '')).strip()  # Accept both 'review_text' and 'comment' for compatibility
    gif_url = request.json.get('gif_url', '').strip()
    
    # Validate that we have either text or GIF (or both)
    if not review_text and not gif_url:
        return jsonify({"status": "Either review text or GIF URL is required"}), 400
    
    # Validate text review if provided
    sanitized_review = None
    if review_text:
        if len(review_text) > 255:
            return jsonify({"status": "Review too long (max 255 characters)"}), 400
        sanitized_review = html.escape(review_text)
    
    # Validate GIF URL if provided
    validated_gif_url = None
    if gif_url:
        if not is_valid_gif_url(gif_url):
            return jsonify({"status": "Invalid GIF URL"}), 400
        validated_gif_url = gif_url
    
    try:
        new_review = Reviews(
            username=user_id, 
            id_game=id_game, 
            review_text=sanitized_review,
            gif_url=validated_gif_url
        )
        db.session.add(new_review)
        db.session.commit()
        
        # Return the created review data with game info
        return jsonify({
            'status': 'review created',
            'review': new_review.to_dict(current_user_id=user_id, include_game_info=True)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error creating review: {str(e)}"}), 500

# Create a comment on a review
@app.route('/api/comment', methods=['POST'])
@token_required
def create_comment():
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
        
    # Verificar campos obrigatórios
    required_fields = ['review_id']
    for field in required_fields:
        if field not in request.json or not request.json[field]:
            return jsonify({"status": f"Field '{field}' is required"}), 400
    
    user_id = request.token_data['user']
    
    # Validate review_id
    try:
        review_id = int(request.json['review_id'])
        review = Reviews.query.get(review_id)
        if not review:
            return jsonify({"status": "Review not found"}), 404
    except ValueError:
        return jsonify({"status": "Review ID must be an integer"}), 400
    
    # Get parent_id for nested comments (optional)
    parent_id = request.json.get('parent_id')
    if parent_id is not None:
        try:
            parent_id = int(parent_id)
            parent_comment = Comments.query.get(parent_id)
            if not parent_comment:
                return jsonify({"status": "Parent comment not found"}), 404
        except ValueError:
            return jsonify({"status": "Parent ID must be an integer"}), 400
    
    # Get comment text and GIF URL
    comment_text = request.json.get('comment', '').strip()
    gif_url = request.json.get('gif_url', '').strip()
    
    # Validate that we have either text or GIF (or both)
    if not comment_text and not gif_url:
        return jsonify({"status": "Either comment text or GIF URL is required"}), 400
    
    # Validate text comment if provided
    sanitized_comment = None
    if comment_text:
        if len(comment_text) > 255:
            return jsonify({"status": "Comment too long (max 255 characters)"}), 400
        sanitized_comment = html.escape(comment_text)
    
    # Validate GIF URL if provided
    validated_gif_url = None
    if gif_url:
        if not is_valid_gif_url(gif_url):
            return jsonify({"status": "Invalid GIF URL"}), 400
        validated_gif_url = gif_url
    
    try:
        new_comment = Comments(
            username=user_id,
            review_id=review_id,
            parent_id=parent_id,
            comment=sanitized_comment,
            gif_url=validated_gif_url
        )
        db.session.add(new_comment)
        db.session.commit()
        
        # Return the created comment data
        return jsonify({
            'status': 'comentario criado',
            'comment': new_comment.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error creating comment: {str(e)}"}), 500

# Get comments for a specific review
@app.route('/api/review/<int:review_id>/comments', methods=['GET'])
@token_required
def get_review_comments(review_id):
    try:
        # Validate that the review exists
        review = Reviews.query.get(review_id)
        if not review:
            return jsonify({"status": "Review not found"}), 404
        
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        
        if page < 1:
            return jsonify({"status": "Page must be at least 1"}), 400
        if size < 1 or size > 100:
            return jsonify({"status": "Size must be between 1 and 100"}), 400
        
        offset = (page - 1) * size
        
        # Get top-level comments (no parent_id) for this review
        total_comments = Comments.query.filter_by(review_id=review_id, parent_id=None).count()
        comments = Comments.query.filter_by(review_id=review_id, parent_id=None).order_by(
            Comments.date_created.asc()
        ).offset(offset).limit(size).all()
        
        # Build comment tree with replies
        comment_dicts = []
        for comment in comments:
            comment_dict = comment.to_dict()
            # Get replies for this comment
            replies = Comments.query.filter_by(parent_id=comment.comment_id).order_by(
                Comments.date_created.asc()
            ).all()
            comment_dict['replies'] = [reply.to_dict() for reply in replies]
            comment_dicts.append(comment_dict)
        
        result = {
            "comments": comment_dicts,
            "pagination": {
                "total": total_comments,
                "pages": (total_comments + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"status": f"Error fetching comments: {str(e)}"}), 500

@app.route('/api/ver', methods = ['GET', 'POST'])
@token_required
def ver():
    # Validar e converter parâmetros da query
    try:
        page = int(request.args.get('page', 1))
        if page < 1:
            return jsonify({"status": "Page must be at least 1"}), 400
    except ValueError:
        return jsonify({"status": "Page must be an integer"}), 400
        
    try:
        size = int(request.args.get('size', 30))
        if size < 1 or size > 100:  # Limitar tamanho para evitar DoS
            return jsonify({"status": "Size must be between 1 and 100"}), 400
    except ValueError:
        return jsonify({"status": "Size must be an integer"}), 400
    
    # Handle different request methods (GET vs POST)
    if request.method == 'POST':
        # Verificar se o corpo da requisição existe
        if not request.is_json:
            return jsonify({"status": "Request must be JSON"}), 400
            
        # Verificar campos obrigatórios
        if 'busca' not in request.json:
            return jsonify({"status": "Search type (busca) is required"}), 400
            
        busca = request.json['busca']
        
        # Validar se busca é um dos valores permitidos
        if busca not in ['game', 'user', 'ambos']:
            return jsonify({"status": "Invalid search type. Must be 'game', 'user', or 'ambos'"}), 400
        
        # Verificar id_game conforme necessário
        if busca in ['game', 'ambos']:
            if 'id_game' not in request.json:
                return jsonify({"status": "Game ID is required for this search type"}), 400
                
            try:
                id_game = int(request.json['id_game'])
                if id_game < 0:  # Changed from <= 0 to < 0 to allow id_game=0 for home feed
                    return jsonify({"status": "Game ID must be non-negative"}), 400
            except ValueError:
                return jsonify({"status": "Game ID must be an integer"}), 400
        else:
            id_game = None
        # New: get user_id from POST body if present
        user_id = request.json.get('user_id')
    else:
        busca = request.args.get('busca')
        if not busca:
            return jsonify({"status": "Search type (busca) is required"}), 400
            
        if busca not in ['game', 'user', 'ambos']:
            return jsonify({"status": "Invalid search type. Must be 'game', 'user', or 'ambos'"}), 400
        
        if busca in ['game', 'ambos']:
            id_game_str = request.args.get('id_game')
            if not id_game_str:
                return jsonify({"status": "Game ID is required for this search type"}), 400
            try:
                id_game = int(id_game_str)
                if id_game < 0:  # Allow id_game=0 for home feed
                    return jsonify({"status": "Game ID must be non-negative"}), 400
            except ValueError:
                return jsonify({"status": "Game ID must be an integer"}), 400
        else:
            id_game = None
        # New: get user_id from GET params if present
        user_id = request.args.get('user_id')
    # Default to logged-in user if not provided
    if user_id is None or user_id == '':
        user_id = request.token_data['user']
    else:
        try:
            user_id = int(user_id)
        except ValueError:
            return jsonify({"status": "user_id must be an integer"}), 400
    offset = (page - 1) * size
    current_user_id = request.token_data['user']
    
    if busca == "game":
        # Get reviews for specific game with cached game info
        total_reviews = Reviews.query.filter_by(id_game=id_game).count()
        reviews = Reviews.query.options(
            db.joinedload(Reviews.game_info),
            db.joinedload(Reviews.user)
        ).filter_by(id_game=id_game).order_by(
            Reviews.date_created.desc()
        ).offset(offset).limit(size).all()
        
        # Ensure all games are cached
        unique_game_ids = list(set([r.id_game for r in reviews]))
        if unique_game_ids:
            get_or_cache_games(db, Games, unique_game_ids)
        
        review_dicts = [review.to_dict(current_user_id=current_user_id, include_game_info=True) for review in reviews]
        
        result = {
            "comments": review_dicts,
            "pagination": {
                "total": total_reviews,
                "pages": (total_reviews + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        return jsonify(result), 200
        
    elif busca == "user":
        # Get reviews for specific user with cached game info
        total_reviews = Reviews.query.filter_by(username=user_id).count()
        reviews = Reviews.query.options(
            db.joinedload(Reviews.game_info),
            db.joinedload(Reviews.user)
        ).filter_by(username=user_id).order_by(
            Reviews.date_created.desc()
        ).offset(offset).limit(size).all()
        
        # Get unique game IDs for batch caching
        unique_game_ids = list(set([r.id_game for r in reviews]))
        if unique_game_ids:
            get_or_cache_games(db, Games, unique_game_ids)
        
        review_dicts = [review.to_dict(current_user_id=current_user_id, include_game_info=True) for review in reviews]
        
        result = {
            "comments": review_dicts,
            "pagination": {
                "total": total_reviews,
                "pages": (total_reviews + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        return jsonify(result), 200
        
    elif busca == "ambos":
        if id_game and id_game > 0:
            # Get reviews for specific game and user
            total_reviews = Reviews.query.filter_by(id_game=id_game, username=user_id).count()
            reviews = Reviews.query.options(
                db.joinedload(Reviews.game_info),
                db.joinedload(Reviews.user)
            ).filter_by(id_game=id_game, username=user_id).order_by(
                Reviews.date_created.desc()
            ).offset(offset).limit(size).all()
            
            # Ensure games are cached
            unique_game_ids = list(set([r.id_game for r in reviews]))
            if unique_game_ids:
                get_or_cache_games(db, Games, unique_game_ids)
            
            review_dicts = [review.to_dict(current_user_id=current_user_id, include_game_info=True) for review in reviews]
        else:
            # For the main feed (id_game=0), include both reviews and reposts with optimized queries
            # Get total counts
            total_reviews = Reviews.query.count()
            total_reposts = Reposts.query.count()
            total_items = total_reviews + total_reposts
            
            # Get reviews with game info preloaded
            reviews = Reviews.query.options(
                db.joinedload(Reviews.game_info),
                db.joinedload(Reviews.user)
            ).order_by(Reviews.date_created.desc()).limit(size * 2).all()
            
            # Get reposts with related data preloaded
            reposts = Reposts.query.options(
                db.joinedload(Reposts.user),
                db.joinedload(Reposts.review).joinedload(Reviews.game_info),
                db.joinedload(Reposts.review).joinedload(Reviews.user)
            ).order_by(Reposts.created_at.desc()).limit(size * 2).all()
            
            # Get unique game IDs for batch caching
            game_ids_from_reviews = [r.id_game for r in reviews]
            game_ids_from_reposts = [r.review.id_game for r in reposts if r.review]
            unique_game_ids = list(set(game_ids_from_reviews + game_ids_from_reposts))
            if unique_game_ids:
                print(f"Caching games for IDs: {unique_game_ids}")
                cached_games = get_or_cache_games(db, Games, unique_game_ids)
                print(f"Cached {len(cached_games)} games")
            
            # Convert to dictionaries with unified format for sorting
            feed_items = []
            
            for review in reviews:
                review_dict = review.to_dict(current_user_id=current_user_id, include_game_info=True)
                print(f"Review {review.id} game_info: {review_dict.get('game_info', 'None')}")
                review_dict['feed_type'] = 'review'
                review_dict['sort_date'] = review.date_created
                feed_items.append(review_dict)
            
            for repost in reposts:
                repost_dict = repost.to_dict(current_user_id=current_user_id)
                repost_dict['feed_type'] = 'repost'
                repost_dict['sort_date'] = repost.created_at
                feed_items.append(repost_dict)
            
            # Sort all items by date (newest first) and paginate
            feed_items.sort(key=lambda x: x['sort_date'], reverse=True)
            
            # Apply pagination to the mixed feed
            paginated_items = feed_items[offset:offset + size]
            
            # Remove the sort_date field as it's only for internal sorting
            for item in paginated_items:
                del item['sort_date']
            
            review_dicts = paginated_items
            
        result = {
            "comments": review_dicts,
            "pagination": {
                "total": total_items if id_game == 0 else total_reviews,
                "pages": ((total_items if id_game == 0 else total_reviews) + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        return jsonify(result), 200
    else:
        return jsonify({"status": "invalid request"}), 400

@app.route('/api/suggestions', methods=['POST'])
def suggestions():
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
    
    if 'query' not in request.json or not request.json['query']:
        return jsonify([]), 400
    
    name = request.json['query']
    
    if len(name) < 2:  # Minimum 2 characters for search
        return jsonify([]), 400
        
    if len(name) > 100:
        return jsonify({"status": "Query too long"}), 400
        
    sanitized_name = name.replace('"', '')
    
    try:
        t = check_token()
        token = t.json()['access_token']
        headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization':f'Bearer {token}'}
        body = f'fields id,name; limit 5; search "{sanitized_name}";'
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        result = response.json()
        
        # Format the data for the frontend
        suggestions = []
        for game in result[:5]:  # Limit to 5 results
            if 'id' in game and 'name' in game:
                suggestions.append({
                    'id': game['id'],
                    'name': game['name']
                })
        
        return jsonify(suggestions), 200
    
    except Exception as e:
        print(f"Error in suggestions route: {str(e)}")
        return jsonify([]), 500

@app.route('/api/gifs/search', methods=['POST'])
def search_gifs():
    """
    Search for GIFs using Giphy API
    Similar to Discord's GIF search functionality
    """
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
    
    if 'query' not in request.json or not request.json['query']:
        return jsonify({"status": "Search query is required"}), 400
    
    query = request.json['query'].strip()
    
    if len(query) < 1:
        return jsonify({"status": "Query too short"}), 400
        
    if len(query) > 100:
        return jsonify({"status": "Query too long"}), 400
    
    # Get optional parameters
    limit = request.json.get('limit', 20)  # Default 20 GIFs
    offset = request.json.get('offset', 0)  # For pagination
    rating = request.json.get('rating', 'pg-13')  # Content rating
    
    # Validate limit
    if not isinstance(limit, int) or limit < 1 or limit > 50:
        limit = 20
    
    # Validate offset
    if not isinstance(offset, int) or offset < 0:
        offset = 0
    
    # Validate rating
    valid_ratings = ['y', 'g', 'pg', 'pg-13', 'r']
    if rating not in valid_ratings:
        rating = 'pg-13'
    
    try:
        # Giphy API request
        giphy_api_key = os.getenv('GIPHY_API_KEY')
        if not giphy_api_key:
            return jsonify({"status": "GIF search service not configured"}), 503
        
        giphy_url = "https://api.giphy.com/v1/gifs/search"
        params = {
            'api_key': giphy_api_key,
            'q': query,
            'limit': limit,
            'offset': offset,
            'rating': rating,
            'lang': 'en'
        }
        
        response = requests.get(giphy_url, params=params, timeout=10)
        
        if response.status_code != 200:
            return jsonify({"status": "GIF search service unavailable"}), 503
        
        data = response.json()
        
        # Format the response for frontend
        gifs = []
        for gif in data.get('data', []):
            gif_data = {
                'id': gif.get('id'),
                'title': gif.get('title', ''),
                'url': gif.get('url'),  # Giphy page URL
                'images': {
                    # Different sizes for different use cases
                    'original': {
                        'url': gif.get('images', {}).get('original', {}).get('url'),
                        'width': gif.get('images', {}).get('original', {}).get('width'),
                        'height': gif.get('images', {}).get('original', {}).get('height'),
                        'size': gif.get('images', {}).get('original', {}).get('size')
                    },
                    'preview': {
                        'url': gif.get('images', {}).get('preview_gif', {}).get('url'),
                        'width': gif.get('images', {}).get('preview_gif', {}).get('width'),
                        'height': gif.get('images', {}).get('preview_gif', {}).get('height')
                    },
                    'fixed_height': {
                        'url': gif.get('images', {}).get('fixed_height', {}).get('url'),
                        'width': gif.get('images', {}).get('fixed_height', {}).get('width'),
                        'height': gif.get('images', {}).get('fixed_height', {}).get('height')
                    },
                    'fixed_width': {
                        'url': gif.get('images', {}).get('fixed_width', {}).get('url'),
                        'width': gif.get('images', {}).get('fixed_width', {}).get('width'),
                        'height': gif.get('images', {}).get('fixed_width', {}).get('height')
                    },
                    'downsized': {
                        'url': gif.get('images', {}).get('downsized', {}).get('url'),
                        'width': gif.get('images', {}).get('downsized', {}).get('width'),
                        'height': gif.get('images', {}).get('downsized', {}).get('height')
                    }
                }
            }
            gifs.append(gif_data)
        
        # Pagination info
        pagination = {
            'total_count': data.get('pagination', {}).get('total_count', 0),
            'count': data.get('pagination', {}).get('count', 0),
            'offset': data.get('pagination', {}).get('offset', 0)
        }
        
        return jsonify({
            'gifs': gifs,
            'pagination': pagination,
            'query': query
        }), 200
    
    except requests.exceptions.Timeout:
        return jsonify({"status": "GIF search timed out"}), 504
    except requests.exceptions.RequestException as e:
        print(f"Giphy API error: {str(e)}")
        return jsonify({"status": "GIF search service error"}), 503
    except Exception as e:
        print(f"Error in GIF search: {str(e)}")
        return jsonify({"status": "An error occurred during GIF search"}), 500


@app.route('/api/gifs/trending', methods=['GET'])
def trending_gifs():
    """
    Get trending GIFs - similar to Discord's trending section
    """
    # Get optional parameters
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    rating = request.args.get('rating', 'pg-13')
    
    # Validate parameters
    if limit < 1 or limit > 50:
        limit = 20
    if offset < 0:
        offset = 0
    
    valid_ratings = ['y', 'g', 'pg', 'pg-13', 'r']
    if rating not in valid_ratings:
        rating = 'pg-13'
    
    try:
        giphy_api_key = os.getenv('GIPHY_API_KEY')
        if not giphy_api_key:
            return jsonify({"status": "GIF service not configured"}), 503
        
        giphy_url = "https://api.giphy.com/v1/gifs/trending"
        params = {
            'api_key': giphy_api_key,
            'limit': limit,
            'offset': offset,
            'rating': rating
        }
        
        response = requests.get(giphy_url, params=params, timeout=10)
        
        if response.status_code != 200:
            return jsonify({"status": "GIF service unavailable"}), 503
        
        data = response.json()
        
        # Format response (same as search)
        gifs = []
        for gif in data.get('data', []):
            gif_data = {
                'id': gif.get('id'),
                'title': gif.get('title', ''),
                'url': gif.get('url'),
                'images': {
                    'original': {
                        'url': gif.get('images', {}).get('original', {}).get('url'),
                        'width': gif.get('images', {}).get('original', {}).get('width'),
                        'height': gif.get('images', {}).get('original', {}).get('height')
                    },
                    'preview': {
                        'url': gif.get('images', {}).get('preview_gif', {}).get('url'),
                        'width': gif.get('images', {}).get('preview_gif', {}).get('width'),
                        'height': gif.get('images', {}).get('preview_gif', {}).get('height')
                    },
                    'fixed_height': {
                        'url': gif.get('images', {}).get('fixed_height', {}).get('url'),
                        'width': gif.get('images', {}).get('fixed_height', {}).get('width'),
                        'height': gif.get('images', {}).get('fixed_height', {}).get('height')
                    },
                    'downsized': {
                        'url': gif.get('images', {}).get('downsized', {}).get('url'),
                        'width': gif.get('images', {}).get('downsized', {}).get('width'),
                        'height': gif.get('images', {}).get('downsized', {}).get('height')
                    }
                }
            }
            gifs.append(gif_data)
        
        pagination = {
            'total_count': data.get('pagination', {}).get('total_count', 0),
            'count': data.get('pagination', {}).get('count', 0),
            'offset': data.get('pagination', {}).get('offset', 0)
        }
        
        return jsonify({
            'gifs': gifs,
            'pagination': pagination
        }), 200
    
    except requests.exceptions.Timeout:
        return jsonify({"status": "Request timed out"}), 504
    except requests.exceptions.RequestException as e:
        print(f"Giphy API error: {str(e)}")
        return jsonify({"status": "GIF service error"}), 503
    except Exception as e:
        print(f"Error getting trending GIFs: {str(e)}")
        return jsonify({"status": "An error occurred"}), 500


@app.route('/api/gifs/categories', methods=['GET'])
def gif_categories():
    """
    Get GIF categories - for Discord-like category browsing
    """
    try:
        giphy_api_key = os.getenv('GIPHY_API_KEY')
        if not giphy_api_key:
            return jsonify({"status": "GIF service not configured"}), 503
        
        giphy_url = "https://api.giphy.com/v1/gifs/categories"
        params = {
            'api_key': giphy_api_key
        }
        
        response = requests.get(giphy_url, params=params, timeout=10)
        
        if response.status_code != 200:
            return jsonify({"status": "GIF service unavailable"}), 503
        
        data = response.json()
        
        categories = []
        for category in data.get('data', []):
            categories.append({
                'name': category.get('name'),
                'name_encoded': category.get('name_encoded'),
                'gif': {
                    'url': category.get('gif', {}).get('images', {}).get('fixed_height', {}).get('url'),
                    'width': category.get('gif', {}).get('images', {}).get('fixed_height', {}).get('width'),
                    'height': category.get('gif', {}).get('images', {}).get('fixed_height', {}).get('height')
                }
            })
        
        return jsonify({'categories': categories}), 200
    
    except requests.exceptions.Timeout:
        return jsonify({"status": "Request timed out"}), 504
    except requests.exceptions.RequestException as e:
        print(f"Giphy API error: {str(e)}")
        return jsonify({"status": "GIF service error"}), 503
    except Exception as e:
        print(f"Error getting categories: {str(e)}")
        return jsonify({"status": "An error occurred"}), 500


# Like/Unlike functionality for reviews
@app.route('/api/review/<int:review_id>/like', methods=['POST'])
@token_required
def like_unlike_review(review_id):
    """
    Like or unlike a review. If the user has already liked the review, 
    it will be unliked. If not liked, it will be liked.
    """
    try:
        user_id = request.token_data['user']
        
        # Validate that the review exists
        review = Reviews.query.get(review_id)
        if not review:
            return jsonify({"status": "Review not found"}), 404
        
        # Check if user has already liked this review
        existing_like = Likes.query.filter_by(user_id=user_id, review_id=review_id).first()
        
        if existing_like:
            # Unlike - remove the like
            db.session.delete(existing_like)
            db.session.commit()
            
            # Get updated like count
            like_count = Likes.query.filter_by(review_id=review_id).count()
            
            return jsonify({
                "status": "unliked",
                "liked": False,
                "like_count": like_count
            }), 200
        else:
            # Like - add a new like
            new_like = Likes(user_id=user_id, review_id=review_id)
            db.session.add(new_like)
            db.session.commit()
            
            # Get updated like count
            like_count = Likes.query.filter_by(review_id=review_id).count()
            
            return jsonify({
                "status": "liked",
                "liked": True,
                "like_count": like_count
            }), 200
            
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error processing like: {str(e)}"}), 500


# Repost functionality for reviews
@app.route('/api/review/<int:review_id>/repost', methods=['POST'])
@token_required
def repost_unrepost_review(review_id):
    """
    Repost or un-repost a review. If the user has already reposted the review, 
    it will be un-reposted. If not reposted, it will be reposted.
    """
    try:
        user_id = request.token_data['user']
        
        # Validate that the review exists
        review = Reviews.query.get(review_id)
        if not review:
            return jsonify({"status": "Review not found"}), 404
        
        # Check if user is trying to repost their own review
        if review.username == str(user_id):
            return jsonify({"status": "Cannot repost your own review"}), 400
        
        # Check if user has already reposted this review
        existing_repost = Reposts.query.filter_by(user_id=user_id, review_id=review_id).first()
        
        if existing_repost:
            # Un-repost - remove the repost
            db.session.delete(existing_repost)
            db.session.commit()
            
            # Get updated repost count
            repost_count = Reposts.query.filter_by(review_id=review_id).count()
            
            return jsonify({
                "status": "unreposted",
                "reposted": False,
                "repost_count": repost_count
            }), 200
        else:
            # Get optional repost text from request body
            repost_text = None
            if request.is_json and 'repost_text' in request.json:
                repost_text = request.json['repost_text'].strip()
                if repost_text and len(repost_text) > 255:
                    return jsonify({"status": "Repost text too long (max 255 characters)"}), 400
                if repost_text:
                    repost_text = html.escape(repost_text)
            
            # Repost - add a new repost
            new_repost = Reposts(user_id=user_id, review_id=review_id, repost_text=repost_text)
            db.session.add(new_repost)
            db.session.commit()
            
            # Get updated repost count
            repost_count = Reposts.query.filter_by(review_id=review_id).count()
            
            return jsonify({
                "status": "reposted",
                "reposted": True,
                "repost_count": repost_count,
                "repost_id": new_repost.id
            }), 200
            
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error processing repost: {str(e)}"}), 500


@app.route('/api/reposts', methods=['GET'])
@token_required 
def get_reposts():
    """
    Get reposts for the feed (similar to getting reviews but for reposts)
    """
    try:
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        
        if page < 1:
            return jsonify({"status": "Page must be at least 1"}), 400
        if size < 1 or size > 100:
            return jsonify({"status": "Size must be between 1 and 100"}), 400
        
        offset = (page - 1) * size
        current_user_id = request.token_data['user']
        
        # Get reposts ordered by creation date (newest first)
        total_reposts = Reposts.query.count()
        reposts = Reposts.query.order_by(Reposts.created_at.desc()).offset(offset).limit(size).all()
        
        reposts_data = []
        for repost in reposts:
            repost_dict = repost.to_dict(current_user_id)
            reposts_data.append(repost_dict)
        
        result = {
            "reposts": reposts_data,
            "pagination": {
                "total": total_reposts,
                "pages": (total_reposts + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"status": f"Error fetching reposts: {str(e)}"}), 500

@app.route('/api/cache/stats', methods=['GET'])
@token_required
def cache_stats():
    """
    Get cache statistics for debugging and monitoring
    """
    try:
        # Get cache statistics
        total_games = Games.query.count()
        recent_games = Games.query.filter(
            Games.last_updated > datetime.utcnow() - timedelta(days=1)
        ).count()
        old_games = Games.query.filter(
            Games.last_updated < datetime.utcnow() - timedelta(days=7)
        ).count()
        
        total_reviews = Reviews.query.count()
        total_users = User.query.count()
        
        stats = {
            'cache': {
                'total_games_cached': total_games,
                'recent_games': recent_games,
                'old_games_needing_refresh': old_games
            },
            'database': {
                'total_reviews': total_reviews,
                'total_users': total_users
            },
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({"status": f"Error getting cache stats: {str(e)}"}), 500

@app.route('/api/cache/refresh', methods=['POST'])
@token_required
def refresh_cache():
    """
    Force refresh of game cache for specific games or all old games
    """
    try:
        if request.is_json and 'game_ids' in request.json:
            # Refresh specific games
            game_ids = request.json['game_ids']
            if not isinstance(game_ids, list) or len(game_ids) > 100:
                return jsonify({"status": "game_ids must be a list with max 100 items"}), 400
            
            refreshed = []
            for game_id in game_ids:
                try:
                    game_id = int(game_id)
                    game_data = fetch_game_from_igdb(game_id)
                    if game_data:
                        cache_game_info(db, Games, game_data)
                        refreshed.append(game_id)
                except Exception as e:
                    print(f"Error refreshing game {game_id}: {str(e)}")
                    continue
            
            return jsonify({
                "status": "refresh completed", 
                "refreshed_games": refreshed,
                "count": len(refreshed)
            }), 200
        else:
            # Refresh all old games (older than 7 days)
            old_games = Games.query.filter(
                Games.last_updated < datetime.utcnow() - timedelta(days=7)
            ).limit(50).all()  # Limit to prevent overwhelming the API
            
            refreshed = []
            for game in old_games:
                try:
                    game_data = fetch_game_from_igdb(game.id)
                    if game_data:
                        cache_game_info(db, Games, game_data)
                        refreshed.append(game.id)
                except Exception as e:
                    print(f"Error refreshing game {game.id}: {str(e)}")
                    continue
            
            return jsonify({
                "status": "refresh completed",
                "refreshed_games": refreshed,
                "count": len(refreshed)
            }), 200
            
    except Exception as e:
        return jsonify({"status": f"Error refreshing cache: {str(e)}"}), 500

@app.route('/api/debug/games', methods=['GET'])
@token_required
def debug_games():
    """
    Debug endpoint to check game caching system
    """
    try:
        # Get some sample reviews
        sample_reviews = Reviews.query.limit(5).all()
        debug_info = {
            'total_reviews': Reviews.query.count(),
            'total_cached_games': Games.query.count(),
            'sample_reviews': []
        }
        
        for review in sample_reviews:
            # Try to get game info
            game_record = Games.query.get(review.id_game)
            
            review_info = {
                'review_id': review.id,
                'game_id': review.id_game,
                'game_cached': game_record is not None,
                'game_name': game_record.name if game_record else 'Not cached',
                'review_has_game_info': hasattr(review, 'game_info') and review.game_info is not None
            }
            
            # Try to cache the game if not already cached
            if not game_record:
                game_data = fetch_game_from_igdb(review.id_game)
                if game_data:
                    cached_game = cache_game_info(db, Games, game_data)
                    review_info['just_cached'] = cached_game is not None
                    review_info['cached_name'] = cached_game.name if cached_game else 'Failed to cache'
            
            debug_info['sample_reviews'].append(review_info)
        
        return jsonify(debug_info), 200
        
    except Exception as e:
        return jsonify({"status": f"Debug error: {str(e)}"}), 500

@app.route('/api/game-news', methods=['GET'])
def get_game_news():
    """
    Fetch game giveaways and deals from GamerPower API
    
    Query parameters:
    - type: filter by type (e.g., 'game', 'loot', 'beta')
    - platform: filter by platform (e.g., 'pc', 'steam', 'epic-games-store')
    - sort-by: sort by 'date', 'value', 'popularity'
    """
    try:
        # Get query parameters
        giveaway_type = request.args.get('type', '')
        platform = request.args.get('platform', '')
        sort_by = request.args.get('sort-by', 'date')
        
        # Build GamerPower API URL
        base_url = "https://www.gamerpower.com/api/giveaways"
        params = []
        
        if giveaway_type:
            params.append(f"type={giveaway_type}")
        if platform:
            params.append(f"platform={platform}")
        if sort_by:
            params.append(f"sort-by={sort_by}")
            
        # Construct final URL
        if params:
            url = f"{base_url}?{'&'.join(params)}"
        else:
            url = base_url
            
        # Make request to GamerPower API
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        giveaways = response.json()
        
        # Process and enhance the data
        processed_giveaways = []
        for giveaway in giveaways:
            processed_giveaway = {
                'id': giveaway.get('id'),
                'title': giveaway.get('title'),
                'description': giveaway.get('description'),
                'image': giveaway.get('image'),
                'thumbnail': giveaway.get('thumbnail'),
                'instructions': giveaway.get('instructions'),
                'open_giveaway_url': giveaway.get('open_giveaway_url'),
                'published_date': giveaway.get('published_date'),
                'type': giveaway.get('type'),
                'platforms': giveaway.get('platforms'),
                'end_date': giveaway.get('end_date'),
                'users': giveaway.get('users'),
                'status': giveaway.get('status'),
                'worth': giveaway.get('worth'),
                'gamerpower_url': giveaway.get('gamerpower_url'),
                'open_giveaway': giveaway.get('open_giveaway')
            }
            processed_giveaways.append(processed_giveaway)
        
        return jsonify({
            "status": "success",
            "data": processed_giveaways,
            "count": len(processed_giveaways),
            "filters": {
                "type": giveaway_type,
                "platform": platform,
                "sort_by": sort_by
            }
        }), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch game news: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"An error occurred: {str(e)}"
        }), 500

@app.route('/api/game-news/worth', methods=['GET'])
def get_game_news_worth():
    """
    Fetch giveaways worth summary from GamerPower API
    Now automatically calculates total worth of all active giveaways
    """
    try:
        # Always use min_value of 0 to get all giveaways for total calculation
        url = "https://www.gamerpower.com/api/worth?min-value=0"
        
        # Make request to GamerPower API
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        worth_data = response.json()
        
        # The worth endpoint returns a summary of all active giveaways
        # Format: {"active_giveaways_number": 92, "worth_estimation_usd": "374.91"}
        
        return jsonify({
            "status": "success",
            "data": {
                "active_giveaways_number": worth_data.get("active_giveaways_number", 0),
                "worth_estimation_usd": worth_data.get("worth_estimation_usd", "0.00"),
                "total_savings_message": f"You could save ${worth_data.get('worth_estimation_usd', '0.00')} by claiming all {worth_data.get('active_giveaways_number', 0)} active giveaways!"
            },
            "type": "total_savings_summary"
        }), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch giveaways worth summary: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"An error occurred: {str(e)}"
        }), 500

@app.route('/api/game-news/complete', methods=['GET'])
def get_complete_game_news():
    """
    Fetch both giveaways and worth summary in a single call for efficiency
    
    Query parameters:
    - type: filter by type (e.g., 'game', 'loot', 'beta')
    - platform: filter by platform (e.g., 'pc', 'steam', 'epic-games-store')
    - sort-by: sort by 'date', 'value', 'popularity'
    """
    try:
        # Get query parameters for giveaways
        giveaway_type = request.args.get('type', '')
        platform = request.args.get('platform', '')
        sort_by = request.args.get('sort-by', 'date')
        
        # Build GamerPower API URL for giveaways
        base_url = "https://www.gamerpower.com/api/giveaways"
        params = []
        
        if giveaway_type:
            params.append(f"type={giveaway_type}")
        if platform:
            params.append(f"platform={platform}")
        if sort_by:
            params.append(f"sort-by={sort_by}")
            
        # Construct final URL for giveaways
        if params:
            giveaways_url = f"{base_url}?{'&'.join(params)}"
        else:
            giveaways_url = base_url
        
        # Fetch giveaways and worth summary concurrently
        giveaways_response = requests.get(giveaways_url, timeout=10)
        worth_response = requests.get("https://www.gamerpower.com/api/worth?min-value=0", timeout=10)
        
        giveaways_response.raise_for_status()
        worth_response.raise_for_status()
        
        giveaways = giveaways_response.json()
        worth_data = worth_response.json()
        
        # Process giveaways data
        processed_giveaways = []
        for giveaway in giveaways:
            processed_giveaway = {
                'id': giveaway.get('id'),
                'title': giveaway.get('title'),
                'description': giveaway.get('description'),
                'image': giveaway.get('image'),
                'thumbnail': giveaway.get('thumbnail'),
                'instructions': giveaway.get('instructions'),
                'open_giveaway_url': giveaway.get('open_giveaway_url'),
                'published_date': giveaway.get('published_date'),
                'type': giveaway.get('type'),
                'platforms': giveaway.get('platforms'),
                'end_date': giveaway.get('end_date'),
                'users': giveaway.get('users'),
                'status': giveaway.get('status'),
                'worth': giveaway.get('worth'),
                'gamerpower_url': giveaway.get('gamerpower_url'),
                'open_giveaway': giveaway.get('open_giveaway')
            }
            processed_giveaways.append(processed_giveaway)
        
        # Process worth data
        worth_summary = {
            "active_giveaways_number": worth_data.get("active_giveaways_number", 0),
            "worth_estimation_usd": worth_data.get("worth_estimation_usd", "0.00"),
            "total_savings_message": f"You could save ${worth_data.get('worth_estimation_usd', '0.00')} by claiming all {worth_data.get('active_giveaways_number', 0)} active giveaways!"
        }
        
        return jsonify({
            "status": "success",
            "giveaways": {
                "data": processed_giveaways,
                "count": len(processed_giveaways),
                "filters": {
                    "type": giveaway_type,
                    "platform": platform,
                    "sort_by": sort_by
                }
            },
            "worth_summary": worth_summary
        }), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch game news: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"An error occurred: {str(e)}"
        }), 500

# Saved Games API Endpoints
@app.route('/api/saved-games', methods=['GET', 'POST', 'DELETE'])
@token_required
def manage_saved_games():
    """
    Manage user's saved games
    GET: Get user's saved games list
    POST: Add a game to saved games
    DELETE: Remove a game from saved games
    """
    try:
        user_id = request.token_data['user']
        user = User.query.filter_by(id=user_id).first()
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        if request.method == 'GET':
            # Get user's saved games
            saved_games = SavedGames.query.filter_by(user_id=user_id).order_by(SavedGames.created_at.desc()).all()
            
            saved_games_data = []
            for saved_game in saved_games:
                saved_game_dict = saved_game.to_dict()
                saved_games_data.append(saved_game_dict)
            
            return jsonify({
                'status': 'success',
                'saved_games': saved_games_data,
                'count': len(saved_games_data)
            }), 200
        
        elif request.method == 'POST':
            # Add game to saved games
            if not request.is_json or 'game_id' not in request.json:
                return jsonify({'status': 'error', 'message': 'game_id is required'}), 400
            
            game_id = request.json['game_id']
            
            # Validate game_id
            if not isinstance(game_id, int) or game_id <= 0:
                return jsonify({'status': 'error', 'message': 'Invalid game_id'}), 400
            
            # Check if game exists in our database, if not fetch and cache it
            game = Games.query.get(game_id)
            if not game:
                # Try to fetch game from IGDB and cache it
                game_data = fetch_game_from_igdb(game_id)
                if not game_data:
                    return jsonify({'status': 'error', 'message': 'Game not found'}), 404
                
                # Cache the game
                cache_game_info(db, Games, game_data)
                game = Games.query.get(game_id)
            
            # Check if already saved
            existing_saved = SavedGames.query.filter_by(user_id=user_id, game_id=game_id).first()
            if existing_saved:
                return jsonify({'status': 'error', 'message': 'Game already saved'}), 400
            
            # Save the game
            new_saved_game = SavedGames(user_id=user_id, game_id=game_id)
            db.session.add(new_saved_game)
            db.session.commit()
            
            return jsonify({
                'status': 'success',
                'message': 'Game saved successfully',
                'saved_game': new_saved_game.to_dict()
            }), 201
        
        elif request.method == 'DELETE':
            # Remove game from saved games
            if not request.is_json or 'game_id' not in request.json:
                return jsonify({'status': 'error', 'message': 'game_id is required'}), 400
            
            game_id = request.json['game_id']
            
            # Find and delete the saved game
            saved_game = SavedGames.query.filter_by(user_id=user_id, game_id=game_id).first()
            if not saved_game:
                return jsonify({'status': 'error', 'message': 'Game not found in saved games'}), 404
            
            db.session.delete(saved_game)
            db.session.commit()
            
            return jsonify({
                'status': 'success',
                'message': 'Game removed from saved games'
            }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': f'Operation failed: {str(e)}'}), 500

@app.route('/api/saved-games/<username>', methods=['GET'])
def get_user_saved_games(username):
    """
    Get another user's saved games (public view)
    """
    try:
        # Find the user
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        # Get user's saved games
        saved_games = SavedGames.query.filter_by(user_id=user.id).order_by(SavedGames.created_at.desc()).all()
        
        saved_games_data = []
        for saved_game in saved_games:
            saved_game_dict = saved_game.to_dict()
            saved_games_data.append(saved_game_dict)
        
        return jsonify({
            'status': 'success',
            'username': username,
            'saved_games': saved_games_data,
            'count': len(saved_games_data)
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to fetch saved games: {str(e)}'}), 500

@app.route('/api/games/search-suggestions', methods=['POST'])
def search_game_suggestions():
    """
    Search for games and return suggestions for saved games feature
    """
    try:
        if not request.is_json or 'query' not in request.json:
            return jsonify({'status': 'error', 'message': 'Search query is required'}), 400
        
        query = request.json['query'].strip()
        if not query or len(query) < 2:
            return jsonify({'status': 'error', 'message': 'Query must be at least 2 characters'}), 400
        
        if len(query) > 100:
            return jsonify({'status': 'error', 'message': 'Query too long'}), 400
        
        # Sanitize query
        sanitized_query = query.replace('"', '')
        
        # Get IGDB access token
        t = check_token()
        token = t.json()['access_token']
        headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization': f'Bearer {token}'}
        
        # Search for games on IGDB
        body = f'fields id,name,cover.url,rating,first_release_date; search "{sanitized_query}"; limit 10;'
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        games = response.json()
        
        if not games:
            return jsonify({
                'status': 'success',
                'games': [],
                'message': 'No games found'
            }), 200
        
        # Format the response
        game_suggestions = []
        for game in games:
            cover_url = None
            if 'cover' in game and 'url' in game['cover']:
                cover_url = game['cover']['url'].replace('t_thumb', 't_cover_big')
                if not cover_url.startswith('http'):
                    cover_url = f"https:{cover_url}"
            
            game_suggestions.append({
                'id': game['id'],
                'name': game['name'],
                'cover_url': cover_url,
                'rating': game.get('rating', 0)
            })
        
        return jsonify({
            'status': 'success',
            'games': game_suggestions
        }), 200
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Search failed: {str(e)}'}), 500

@app.route('/api/games/most-reviewed-week', methods=['GET'])
@token_required
def get_most_reviewed_games_week():
    """
    Get the most reviewed games of the week with their latest review
    """
    try:
        current_user_id = request.token_data['user']
        
        # Calculate the date range for the past week
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        
        # Get the most reviewed games in the past week with review counts
        game_review_counts = db.session.query(
            Reviews.id_game,
            db.func.count(Reviews.id).label('review_count'),
            db.func.max(Reviews.date_created).label('latest_review_date')
        ).filter(
            Reviews.date_created >= one_week_ago
        ).group_by(
            Reviews.id_game
        ).order_by(
            db.desc(db.func.count(Reviews.id))
        ).limit(10).all()
        
        if not game_review_counts:
            return jsonify({
                'status': 'success',
                'games': [],
                'message': 'No reviews found in the past week'
            }), 200
        
        result_games = []
        
        for game_count in game_review_counts:
            game_id = game_count.id_game
            review_count = game_count.review_count
            
            # Get the game information from cache
            game_record = Games.query.get(game_id)
            
            # If game is not cached or needs refresh, fetch from IGDB
            if not game_record or Games.should_refresh(game_record):
                game_data = fetch_game_from_igdb(game_id)
                if game_data:
                    game_record = cache_game_info(db, Games, game_data)
            
            if not game_record:
                continue  # Skip if we couldn't get game data
            
            # Get the latest review for this game
            latest_review = Reviews.query.options(
                db.joinedload(Reviews.user)
            ).filter_by(
                id_game=game_id
            ).order_by(
                Reviews.date_created.desc()
            ).first()
            
            latest_review_data = None
            if latest_review:
                latest_review_data = latest_review.to_dict(
                    current_user_id=current_user_id, 
                    include_game_info=False
                )
            
            # Add game information with review count and latest review
            game_data = {
                'game': game_record.to_dict(),
                'review_count': review_count,
                'latest_review': latest_review_data
            }
            
            result_games.append(game_data)
        
        return jsonify({
            'status': 'success',
            'games': result_games,
            'count': len(result_games)
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error', 
            'message': f'Failed to fetch most reviewed games: {str(e)}'
        }), 500

# Create all tables
with app.app_context():
    db.create_all()

# Helper functions for file upload
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/profile/upload', methods=['POST'])
@token_required
def upload_profile_photo():
    """Upload and update user's profile photo"""
    try:
        user_id = request.token_data['user']
        user = User.query.filter_by(id=user_id).first()
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        if 'file' not in request.files:
            return jsonify({'status': 'error', 'message': 'No file part'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'No selected file'}), 400
        
        if file and allowed_file(file.filename):
            # Get original file extension
            original_ext = file.filename.rsplit('.', 1)[1].lower()
            # Generate unique filename keeping original extension
            filename = f"{user_id}_{uuid.uuid4().hex}.{original_ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # Delete old profile photo if exists
            if user.profile_photo:
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], user.profile_photo)
                if os.path.exists(old_filepath):
                    try:
                        os.remove(old_filepath)
                    except OSError:
                        pass
            
            # Save the file directly without processing
            file.save(filepath)
            
            # Update user's profile photo in database
            user.profile_photo = filename
            db.session.commit()
            
            return jsonify({
                'status': 'success',
                'message': 'Profile photo updated successfully',
                'photo_url': f'/api/profile/photo/{filename}'
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, WEBP'}), 400
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Upload failed: {str(e)}'}), 500

@app.route('/api/profile/photo/<filename>')
def get_profile_photo(filename):
    """Serve profile photos"""
    try:
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    except FileNotFoundError:
        return jsonify({'status': 'error', 'message': 'Photo not found'}), 404

@app.route('/api/profile/update', methods=['POST'])
@token_required  
def update_profile():
    """Update user profile information"""
    try:
        user_id = request.token_data['user']
        user = User.query.filter_by(id=user_id).first()
        
        if not user:
            return jsonify({'status': 'error', 'message': 'User not found'}), 404
        
        if not request.is_json:
            return jsonify({'status': 'error', 'message': 'Content-Type must be application/json'}), 400
        
        data = request.json
        updated_fields = []
        
        # Update username if provided
        if 'username' in data and data['username'].strip():
            new_username = data['username'].strip()
            
            # Check if username is different
            if new_username != user.username:
                # Check if username is already taken
                existing_user = User.query.filter_by(username=new_username).first()
                if existing_user:
                    return jsonify({'status': 'error', 'message': 'Username already taken'}), 400
                
                # Validate username format (alphanumeric + underscore, 3-20 chars)
                if not new_username.replace('_', '').isalnum() or len(new_username) < 3 or len(new_username) > 20:
                    return jsonify({'status': 'error', 'message': 'Username must be 3-20 characters and contain only letters, numbers, and underscores'}), 400
                
                user.username = new_username
                updated_fields.append('username')
        
        if updated_fields:
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': f'Profile updated successfully',
                'updated_fields': updated_fields,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'profile_photo': f'/api/profile/photo/{user.profile_photo}' if user.profile_photo else None
                }
            }), 200
        else:
            return jsonify({'status': 'error', 'message': 'No valid fields to update'}), 400
            
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': f'Update failed: {str(e)}'}), 500

# Delete a review (only by the owner)
@app.route('/api/review/<int:review_id>', methods=['DELETE'])
@token_required
def delete_review(review_id):
    """Delete a review - only the owner can delete their review"""
    try:
        user_id = request.token_data['user']
        
        # Find the review
        review = Reviews.query.get(review_id)
        if not review:
            return jsonify({"status": "Review not found"}), 404
        
        # Check if the current user is the owner of the review
        if review.username != user_id:
            return jsonify({"status": "Unauthorized - you can only delete your own reviews"}), 403
        
        # Delete related data first (due to foreign key constraints)
        # Delete likes on this review
        Likes.query.filter_by(review_id=review_id).delete()
        
        # Delete comments on this review
        Comments.query.filter_by(review_id=review_id).delete()
        
        # Delete reposts of this review
        Reposts.query.filter_by(review_id=review_id).delete()
        
        # Finally delete the review
        db.session.delete(review)
        db.session.commit()
        
        return jsonify({
            "status": "Review deleted successfully"
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error deleting review: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=False)
