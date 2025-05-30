from flask import Flask, request, jsonify, make_response, request, render_template, session, flash
import requests
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
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

app = Flask(__name__)
CORS(app)

# Only load .env file if not in production (when FLASK_ENV is not 'production')
if os.getenv('FLASK_ENV') != 'production':
    load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = f'{os.getenv("DB_URI")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', os.getenv('secret'))  # Fallback to 'secret' for backward compatibility
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), unique=False, nullable=False)
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

# Reviews table - what was previously called "Comments"
class Reviews(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    id_game = db.Column(db.Integer, unique=False, nullable=False)
    username = db.Column(db.String(80), unique=False, nullable=False)
    review_text = db.Column(db.String(255), unique=False, nullable=True)  # Allow null for GIF-only reviews
    gif_url = db.Column(db.String(500), unique=False, nullable=True)  # For GIF URLs
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Review {self.id}>'

    def to_dict(self, current_user_id=None):
        # Get the actual username from the User model
        user = User.query.filter_by(id=self.username).first()
        display_username = user.username if user else f"User {self.username}"
        
        # Get comment count for this review
        comment_count = Comments.query.filter_by(review_id=self.id).count()
        
        # Get likes count for this review
        likes_count = Likes.query.filter_by(review_id=self.id).count()
        
        # Check if current user has liked this review
        user_has_liked = False
        if current_user_id:
            user_has_liked = Likes.query.filter_by(
                review_id=self.id, 
                user_id=current_user_id
            ).first() is not None
        
        return {
            "id": self.id, 
            "id_game": self.id_game, 
            "user_id": self.username,  # Keep the original ID for reference
            "username": display_username,  # Add the actual username
            "review_text": self.review_text if self.review_text else "",  # Handle null reviews
            "gif_url": self.gif_url,
            "has_text": bool(self.review_text and self.review_text.strip()),
            "has_gif": bool(self.gif_url),
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S'),
            "comment_count": comment_count,
            "likes_count": likes_count,
            "user_has_liked": user_has_liked
        }

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
        
        return {
            "comment_id": self.comment_id,
            "parent_id": self.parent_id,
            "review_id": self.review_id,
            "user_id": self.username,  # Keep the original ID for reference
            "username": display_username,  # Add the actual username
            "comment": self.comment if self.comment else "",  # Handle null comments
            "gif_url": self.gif_url,
            "has_text": bool(self.comment and self.comment.strip()),
            "has_gif": bool(self.gif_url),
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S'),
            "reply_count": len(self.replies) if hasattr(self, 'replies') else 0
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

        if id_value <= 0 or id_value > 1000000000:  # Ajuste o limite superior conforme necessário
            return jsonify({"status": "ID out of acceptable range"}), 400
        
        t = check_token()
        token = t.json()['access_token']
        headers = {
            'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 
            'Authorization': f'Bearer {token}'
        }
        body = 'fields name, cover.*, rating, artworks.*, summary, release_dates.human, platforms.name ;where id = {};'.format(id_value)
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        
        if not response.json():
            return jsonify({"status": "Game not found"}), 404
        return jsonify(response.json()), 200
    except ValueError as e:
        return jsonify({"status": f"Invalid ID format: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"status": f"An error occurred: {str(e)}"}), 500
    except Exception as e:
        print(f"Error in /game route: {str(e)}")
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
        return jsonify({'status': user.username}), 200
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
            'comment_count': review_count,  # Keep the same key for backward compatibility
            'is_following': is_following,
            'is_own_profile': current_user_id == user.id
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
        
        # Return the created review data
        return jsonify({
            'status': 'review created',
            'review': new_review.to_dict(current_user_id=user_id)
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
    if busca == "game":
        total_reviews = Reviews.query.filter_by(id_game=id_game).count()
        reviews = Reviews.query.filter_by(id_game=id_game).order_by(Reviews.date_created.desc()).offset(offset).limit(size).all()
        review_dicts = [review.to_dict(current_user_id=request.token_data['user']) for review in reviews]
        result = {
            "comments": review_dicts,  # Keep 'comments' key for backward compatibility
            "pagination": {
                "total": total_reviews,
                "pages": (total_reviews + size - 1) // size,
                "current_page": page,
                "per_page": size
            }
        }
        return jsonify(result), 200
    elif busca == "user":
        total_reviews = Reviews.query.filter_by(username=user_id).count()
        reviews = Reviews.query.filter_by(username=user_id).order_by(
            Reviews.date_created.desc()
        ).offset(offset).limit(size).all()
        review_dicts = [review.to_dict(current_user_id=request.token_data['user']) for review in reviews]
        result = {
            "comments": review_dicts,  # Keep 'comments' key for backward compatibility
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
            total_reviews = Reviews.query.filter_by(id_game=id_game, username=user_id).count()
            reviews = Reviews.query.filter_by(id_game=id_game, username=user_id).order_by(
                Reviews.date_created.desc()
            ).offset(offset).limit(size).all()
        else:
            total_reviews = Reviews.query.count()
            reviews = Reviews.query.order_by(
                Reviews.date_created.desc()
            ).offset(offset).limit(size).all()
        review_dicts = [review.to_dict(current_user_id=request.token_data['user']) for review in reviews]
        result = {
            "comments": review_dicts,  # Keep 'comments' key for backward compatibility
            "pagination": {
                "total": total_reviews,
                "pages": (total_reviews + size - 1) // size,
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


# Create all tables
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=False)
