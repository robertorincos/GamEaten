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

class Comments(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    id_game = db.Column(db.Integer, unique=False, nullable=False)
    username = db.Column(db.String(80), unique=False, nullable=False)
    Comment = db.Column(db.String(255), unique=False, nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Comment {self.id}>'

    def to_dict(self):
        return {
            "id": self.id, 
            "id_game": self.id_game, 
            "username": self.username, 
            "comment": self.Comment, 
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S')
        }

@app.route('/auth')
@token_required
def auth():
    return 'JWT is verified. Welcome to your dashboard ! '

@app.route('/search', methods=['POST'])
def search():
    t = check_token()
    token = t.json()['access_token']
    name = request.json['query']
    headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization':f'Bearer {token}'}
    body =f'fields *; search "{name}";'
    x = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
    return jsonify(x.json()[0]['id']), 200

@app.route('/game', methods=['GET'])
def game():
    id = request.json['id']
    if isinstance(id, int):
        t = check_token()
        token = t.json()['access_token']
        headers = {'Client-ID': f'{os.getenv("IGDB_CLIENT")}', 'Authorization':f'Bearer {token}'}
        body =f'fields name, cover.*, rating, artworks.*, summary, release_dates.human, platforms.name ;where id = {id};'
        x = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
        return jsonify(x.json()), 200
    else:
        return jsonify({"status": "Invalid ID format. Integer required."}), 400

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
            return jsonify({'status': 'password wrong'}), 400
    else:
        return jsonify({'status': 'email not found'}), 404

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
    
    return jsonify({'status': 'password changed'}), 200 

@app.route('/user', methods=['POST'])
@token_required
def user():
    id = request.token_data['user']
    user = User.query.filter_by(id=id).first()
    if user:
        return jsonify({'status': user.username}), 200
    else:
        return jsonify({'status': 'User not found'}), 404
    
# cria um comentario
@app.route('/comment', methods=['POST'])
@token_required
def comment():
    id = request.token_data['user']
    id_game = request.json['id_game']
    commented = request.json['comment']
    new_comment = Comments(username=id, id_game=id_game, Comment=commented)
    db.session.add(new_comment)
    db.session.commit()
    return {'status': 'comentario criado'}, 200

# edita um comentario feito por voce
@app.route('/comment/<int:id>', methods=['PUT'])
@token_required
def edit(id):
    #apenas o criador editar
    comment = Comments.query.get_or_404(id)
    comment.Comment = request.json['new_comment']
    db.session.commit()
    return {"status":"comentario atualizado"}, 200


# remover um comentario feito por voce
@app.route('/comment/<int:id>', methods=['DELETE'])
@token_required
def delete(id):
    #apenas o criador deletar
    comment = Comments.query.get_or_404(id)
    db.session.delete(comment)
    db.session.commit()
    return {"status":"comentario deletado"}, 200

@app.route('/ver', methods = ['GET'])
@token_required
def ver():
    page = request.args.get('page', 1)
    size = request.args.get('size', 30)
    id_game = request.json['id_game']
    username = request.token_data['user']
    busca = request.json['busca']
    total_comments = Comments.query.filter_by(id_game=id_game).count()
    
    if busca == "game":
        comments = Comments.query.filter_by(id_game=id_game).limit(size).all()
        comment_dicts = [comment.to_dict() for comment in comments]
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
    # if busca == "user":
    #     comments = Comments.query.filter_by(username=username).all()
    #     return jsonify(comments.json()), 200
    # if busca == "ambos":
    #     comments = Comments.query.filter_by(id_game=id_game, username=username).all()
    #     return jsonify(comments.json()), 200
    # else:
    #     return jsonify({"status": "invalide request"}), 400

if __name__ == "__main__":
    app.run()
    