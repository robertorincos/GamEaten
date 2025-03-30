from flask import Flask, request, jsonify, make_response, request, render_template, session, flash
import requests
from flask_sqlalchemy import SQLAlchemy
import json
from os import urandom
import bcrypt
from funcs import *
import os
from dotenv import load_dotenv, set_key
import jwt

app = Flask(__name__)
load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = f'{os.getenv("DB_URI")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('secret')
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), unique=False, nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

def token_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token and request.is_json and 'token' in request.json:
            token = request.json['token']
            
        if not token:
            return jsonify({'Alert!': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
                
        except jwt.ExpiredSignatureError:
            return jsonify({'Message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'Message': 'Invalid token'}), 403
        
        request.token_data = data
        
        return func(*args, **kwargs)
    return decorated

@app.route('/')
def home():
    if not session.get('logged_in'):
        return render_template('login.html')
    else:
        return 'logged in currently'
    
@app.route('/public')
def public():
    return 'For Public'

@app.route('/auth')
@token_required
def auth():
    return 'JWT is verified. Welcome to your dashboard ! '

# Login page

@app.route('/search', methods=['POST'])
def search():
    t = check_token()
    token = t.json()['access_token']
    name = request.json['query']
    headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization':f'Bearer {token}'}
    body =f'fields *; search "{name}";'
    x = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
    return jsonify(x.json())


@app.route('/register', methods=['POST'])
def register():
    info = request.json
    hashed_password_bytes = hash_password(info['pass'])
    hashed_password = hashed_password_bytes.decode('utf-8')
    info.update({'pass' : hashed_password})
    user = request.json['user']
    password = request.json['pass']
    email = request.json['email']     
    new_user = User(username=user, email=email, password=password)
    db.session.add(new_user)
    db.session.commit()
    info.pop('pass')
    return info

#login
# @app.route('/login', methods=['POST'])
# def login():
#     password = request.json['pass']
#     email = request.json['email']
#     user = User.query.filter_by(email=email).first()
#     if user:
#         passworddb = user.password.encode('utf-8')
#         if verify_password(password,passworddb):
#             control = 'login ok'
#         else:
#             control =  'password wrong'
#     else:
#         control = 'email not found'
#     return {'status':f'{control}'}

@app.route('/login', methods=['POST'])
def login():
    password = request.json['pass']
    email = request.json['email']
    user = User.query.filter_by(email=email).first()
    
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password, passworddb):
            # Login successful, generate JWT token
            token = jwt.encode({
                'user': user.email,  # or user.id or any identifier you prefer
                'expiration': str(datetime.utcnow() + timedelta(seconds=60))
            }, app.config['SECRET_KEY'])
            
            return jsonify({
                'status': 'login ok',
                'token': token.decode('utf-8') if isinstance(token, bytes) else token
            })
        else:
            return jsonify({'status': 'password wrong'})
    else:
        return jsonify({'status': 'email not found'})

#change-password
# @app.route('/change-password', methods=['POST'])
# def change_password():
#     info = request.json
#     password = request.json['pass']
#     email = request.json['email']
#     user = User.query.filter_by(email=email).first()
#     if user:
#         passworddb = user.password.encode('utf-8')
#         if verify_password(password,passworddb):
#             control = 'login ok'
#             hashed_password_bytes = hash_password(info['new'])
#             hashed_password = hashed_password_bytes.decode('utf-8')
#             info.update({'pass' : hashed_password})
#             info.pop('new')
#             password = request.json['pass']
#             user.password=password
#             db.session.commit()
#             control = 'password changed'
#         else:
#             control = 'wrong password'
#     else:
#         control = 'email incorrect'
#     return {'status':f'{control}'}
@app.route('/change-password', methods=['POST'])
@token_required
def change_password():
    # Token is already validated by the decorator
    email = request.token_data['user']
    
    # Check if new password is provided
    if not request.is_json or 'new' not in request.json:
        return jsonify({'status': 'New password required'}), 400
    
    # Get user from database using token data
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'status': 'User not found'}), 404
    
    # Optional: Verify current password for additional security
    if 'current_pass' in request.json:
        current_password = request.json['current_pass']
        passworddb = user.password.encode('utf-8')
        if not verify_password(current_password, passworddb):
            return jsonify({'status': 'Current password incorrect'}), 403
    
    # Hash and store the new password
    new_password = request.json['new']
    hashed_password_bytes = hash_password(new_password)
    hashed_password = hashed_password_bytes.decode('utf-8')
    
    # Update the user's password
    user.password = hashed_password
    db.session.commit()
    
    return jsonify({'status': 'password changed'})

#user
# @app.route('/user', methods=['POST'])
# def user():
#     info = request.json
#     password = request.json['pass']
#     email = request.json['email']
#     user = User.query.filter_by(email=email).first()
#     if user:
#         passworddb = user.password.encode('utf-8')
#         if verify_password(password,passworddb):
#             control = user.username
#         else:
#             control = 'wrong password'
#     else:
#         control = 'email not found'
#     return {'status':f'{control}'}

@app.route('/user', methods=['POST'])
@token_required
def user():
    email = request.token_data['user']
    user = User.query.filter_by(email=email).first()
    if user:
        return jsonify({'status': user.username})
    else:
        return jsonify({'status': 'User not found'}), 404

# Create all tables
# with app.app_context():
#     db.drop_all()
#     db.create_all()

if __name__ == "__main__":
    app.run()