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
            data = jwt.decode(token, os.getenv('secret'), algorithms=["HS256"])
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