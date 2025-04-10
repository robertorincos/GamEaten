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
    return jsonify(x.json()), 200

# rota que com base no id do jogo (no igdb) retorna TODOS os dados do jogo
# necessário:
# nome do jogo
# descrição do jogo
# poster do jogo
# imagens cover (links)
# avaliacoes de criticos e jogadores (links)
# data de lançamento
# plataformas


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
    return info, 201

@app.route('/login', methods=['POST'])
def login():
    password = request.json['pass']
    email = request.json['email']
    user = User.query.filter_by(email=email).first()
    
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password, passworddb):
            token = jwt.encode({
                'user': user.id,  
                'expiration': str(datetime.utcnow() + timedelta(days=30))
            }, app.config['SECRET_KEY'])
            
            return jsonify({
                'status': 'login ok',
                'token': token.decode('utf-8') if isinstance(token, bytes) else token
            }), 200
        else:
            return jsonify({'status': 'password wrong'})
    else:
        return jsonify({'status': 'email not found'})

@app.route('/change-password', methods=['POST'])
@token_required
def change_password():

    email = request.token_data['user']
    
    if not request.is_json or 'new' not in request.json:
        return jsonify({'status': 'New password required'}), 400
    
    user = User.query.filter_by(email=email).first()
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
    
    return jsonify({'status': 'password changed'})

@app.route('/user', methods=['POST'])
@token_required
def user():
    id = request.token_data['user']
    user = User.query.filter_by(id=id).first()
    if user:
        return jsonify({'status': user.username})
    else:
        return jsonify({'status': 'User not found'}), 404
    
    
    
    
# cria um comentario
# @app.route('/comment', methods=['POST'])
# @token_required

# edita um comentario feito por voce
# @app.route('/comment/<int:id>', methods=['PUT'])
# @token_required

# remover um comentario feito por voce
# @app.route('/comment/<int:id>', methods=['DELETE'])
# @token_required

if __name__ == "__main__":
    app.run()
    