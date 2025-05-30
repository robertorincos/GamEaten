import bcrypt
import json
import requests
from flask import Flask, jsonify, request
import os
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps
import jwt
from urllib.parse import urlparse

load_dotenv()

def hash_password(plain_password: str) -> bytes:
    """
    Receives a plain text password, returns the hashed password as bytes.
    The salt is embedded in the returned hash.
    """
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed_password

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if a plain text password matches a previously hashed password.
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

# function to add to JSON
def write_json(new_data, filename='db.json'):
    with open(filename,'r+') as file:
          # First we load existing data into a dict.
        file_data = json.load(file)
        # Join new_data with file_data inside emp_details
        file_data["users"].append(new_data)
        # Sets file's current position at offset.
        file.seek(0)
        # convert back to json.
        json.dump(file_data, file, indent = 4)
        
def save_json(file_path: str, data) -> None:
    """
    Save a Python dictionary (or list) to a file as JSON.
    """
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def check_token():
    client = os.getenv("IGDB_CLIENT")
    secret = os.getenv("CLIENT_SECRET")
    params = {'client_id':f'{client}', 'client_secret':f'{secret}', 'grant_type':'client_credentials'}
    x = requests.post(f'https://id.twitch.tv/oauth2/token', params=params)
    return x

def token_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'Alert!': 'Token is missing!'}), 401
        try:
            secret = os.getenv('secret') or os.getenv('SECRET_KEY')
            if isinstance(secret, bytes):
                secret = secret.decode('utf-8')
            data = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({'Message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'Message': 'Invalid token'}), 403
        
        request.token_data = data
        
        return func(*args, **kwargs)
    return decorated

def is_valid_gif_url(url):
    """
    Validate if a URL is a valid GIF URL
    Supports Giphy, Tenor, and direct GIF URLs
    """
    if not url or not isinstance(url, str):
        return False
    
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        
        # Check for HTTPS
        if parsed.scheme != 'https':
            return False
        
        # Allow Giphy URLs
        if 'giphy.com' in parsed.netloc or 'gph.is' in parsed.netloc:
            return True
        
        # Allow Tenor URLs
        if 'tenor.com' in parsed.netloc or 'tenorapi.com' in parsed.netloc:
            return True
        
        # Allow direct GIF URLs from trusted domains
        trusted_domains = [
            'media.giphy.com',
            'i.giphy.com',
            'media.tenor.com',
            'c.tenor.com',
            'media1.tenor.com',
            'media2.tenor.com',
            'media3.tenor.com',
            'i.imgur.com'
        ]
        
        if any(domain in parsed.netloc for domain in trusted_domains):
            # Check if it ends with .gif or has gif in the path
            if url.lower().endswith('.gif') or 'gif' in url.lower():
                return True
        
        return False
        
    except Exception:
        return False

def get_igdb_headers():
    """Get headers for IGDB API requests with fresh token"""
    t = check_token()
    token = t.json()['access_token']
    return {
        'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 
        'Authorization': f'Bearer {token}'
    }

def fetch_game_from_igdb(game_id):
    """
    Fetch complete game information from IGDB API
    Returns formatted game data or None if not found
    """
    try:
        headers = get_igdb_headers()
        body = f'fields name, cover.*, rating, artworks.*, summary, release_dates.human, platforms.name; where id = {game_id};'
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        
        if response.status_code != 200:
            return None
            
        games_data = response.json()
        if not games_data:
            return None
            
        game = games_data[0]
        
        # Format cover URL
        cover_url = None
        if 'cover' in game and 'url' in game['cover']:
            cover_url = format_cover_url(game['cover']['url'])
        
        # Format artwork URLs
        artwork_urls = []
        if 'artworks' in game:
            for artwork in game['artworks']:
                if 'url' in artwork:
                    artwork_urls.append(format_artwork_url(artwork['url']))
        
        # Format platforms
        platforms = []
        if 'platforms' in game:
            platforms = [{'id': p.get('id'), 'name': p.get('name')} for p in game['platforms']]
        
        # Format release date
        release_date = None
        if 'release_dates' in game and game['release_dates']:
            release_date = game['release_dates'][0].get('human', '')
        
        return {
            'id': game['id'],
            'name': game.get('name', 'Unknown Game'),
            'summary': game.get('summary', ''),
            'rating': game.get('rating'),
            'cover_url': cover_url,
            'release_date': release_date,
            'platforms': json.dumps(platforms),
            'artwork_urls': json.dumps(artwork_urls)
        }
        
    except Exception as e:
        print(f"Error fetching game {game_id} from IGDB: {str(e)}")
        return None

def batch_fetch_games_from_igdb(game_ids):
    """
    Fetch multiple games from IGDB in a single request
    Returns dict mapping game_id to game_data
    """
    if not game_ids:
        return {}
    
    try:
        headers = get_igdb_headers()
        ids_str = ','.join(map(str, game_ids))
        body = f'fields name, cover.*, rating, artworks.*, summary, release_dates.human, platforms.name; where id = ({ids_str}); limit {len(game_ids)};'
        response = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        
        if response.status_code != 200:
            return {}
            
        games_data = response.json()
        result = {}
        
        for game in games_data:
            # Format cover URL
            cover_url = None
            if 'cover' in game and 'url' in game['cover']:
                cover_url = format_cover_url(game['cover']['url'])
            
            # Format artwork URLs
            artwork_urls = []
            if 'artworks' in game:
                for artwork in game['artworks']:
                    if 'url' in artwork:
                        artwork_urls.append(format_artwork_url(artwork['url']))
            
            # Format platforms
            platforms = []
            if 'platforms' in game:
                platforms = [{'id': p.get('id'), 'name': p.get('name')} for p in game['platforms']]
            
            # Format release date
            release_date = None
            if 'release_dates' in game and game['release_dates']:
                release_date = game['release_dates'][0].get('human', '')
            
            result[game['id']] = {
                'id': game['id'],
                'name': game.get('name', 'Unknown Game'),
                'summary': game.get('summary', ''),
                'rating': game.get('rating'),
                'cover_url': cover_url,
                'release_date': release_date,
                'platforms': json.dumps(platforms),
                'artwork_urls': json.dumps(artwork_urls)
            }
        
        return result
        
    except Exception as e:
        print(f"Error batch fetching games from IGDB: {str(e)}")
        return {}

def format_cover_url(url):
    """Format cover image URL for display"""
    if not url:
        return None
    
    # Handle URLs that start with //
    if url.startswith('//'):
        return f"https:{url.replace('t_thumb', 't_cover_big')}"
    
    # Handle URLs that already have http/https
    if url.startswith('http'):
        return url.replace('t_thumb', 't_cover_big')
    
    # Handle relative URLs
    return f"https://images.igdb.com/igdb/image/upload/t_cover_big/{url.replace('t_thumb/', '')}"

def format_artwork_url(url):
    """Format artwork image URL for display"""
    if not url:
        return None
    
    # Handle URLs that start with //
    if url.startswith('//'):
        return f"https:{url.replace('t_thumb', 't_original')}"
    
    # Handle URLs that already have http/https
    if url.startswith('http'):
        return url.replace('t_thumb', 't_original')
    
    # Handle relative URLs
    return f"https://images.igdb.com/igdb/image/upload/t_original/{url.replace('t_thumb/', '')}"

def cache_game_info(db, Games, game_data):
    """
    Cache game information in the local database
    Returns the Games record
    """
    try:
        # Check if game already exists
        existing_game = Games.query.get(game_data['id'])
        
        if existing_game:
            # Update existing record
            existing_game.name = game_data['name']
            existing_game.summary = game_data['summary']
            existing_game.rating = game_data['rating']
            existing_game.cover_url = game_data['cover_url']
            existing_game.release_date = game_data['release_date']
            existing_game.platforms = game_data['platforms']
            existing_game.artwork_urls = game_data['artwork_urls']
            existing_game.last_updated = datetime.utcnow()
            game_record = existing_game
        else:
            # Create new record
            game_record = Games(
                id=game_data['id'],
                name=game_data['name'],
                summary=game_data['summary'],
                rating=game_data['rating'],
                cover_url=game_data['cover_url'],
                release_date=game_data['release_date'],
                platforms=game_data['platforms'],
                artwork_urls=game_data['artwork_urls']
            )
            db.session.add(game_record)
        
        db.session.commit()
        return game_record
        
    except Exception as e:
        db.session.rollback()
        print(f"Error caching game info: {str(e)}")
        return None

def get_or_cache_games(db, Games, game_ids):
    """
    Get games from cache or fetch from IGDB if needed
    Returns dict mapping game_id to Games record
    """
    if not game_ids:
        return {}
    
    result = {}
    missing_game_ids = []
    
    # Check cache first
    for game_id in game_ids:
        cached_game = Games.query.get(game_id)
        
        if cached_game and not Games.should_refresh(cached_game):
            result[game_id] = cached_game
        else:
            missing_game_ids.append(game_id)
    
    # Fetch missing games from IGDB
    if missing_game_ids:
        igdb_games = batch_fetch_games_from_igdb(missing_game_ids)
        
        for game_id, game_data in igdb_games.items():
            cached_game = cache_game_info(db, Games, game_data)
            if cached_game:
                result[game_id] = cached_game
    
    return result