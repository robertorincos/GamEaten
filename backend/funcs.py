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
import app

load_dotenv()

def hash_password(plain_password: str) -> bytes:
    """
    Receives a plain text password, returns the hashed password as bytes.
    The salt is embedded in the returned hash.
    """
    # Generate a salt (which includes the cost factor)
    salt = bcrypt.gensalt()
    # Hash the password with the salt
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
    # decorator factory which invoks update_wrapper() method and passes decorated function as an argument
    @wraps(func)
    def decorated(*args, **kwargs):
        token = request.args.get('token')
        if not token:
            return jsonify({'Alert!': 'Token is missing!'}), 401

        try:

            data = jwt.decode(token, app.config['SECRET_KEY'])
        # You can use the JWT errors in exception
        # except jwt.InvalidTokenError:
        #     return 'Invalid token. Please log in again.'
        except:
            return jsonify({'Message': 'Invalid token'}), 403
        return func(*args, **kwargs)
    return decorated