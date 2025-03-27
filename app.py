from flask import Flask, jsonify, request
import requests
from flask_sqlalchemy import SQLAlchemy
import json
from os import urandom
import bcrypt
from funcs import *

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), unique=False, nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'

@app.route('/')
def index():
    return {'status':'pass'}


@app.route('/search', methods=['POST'])
def search():
    name = request.json['query']
    headers = {'Client-ID': 'l5p5jkv0j41qlrng397tkpqjmve2fl', 'Authorization':'Bearer gl3lnko3yhqirxu4500s5u1oounqdi'}
    body =f'fields *; search "{name}";'
    x = requests.post('https://api.igdb.com/v4/games/', headers=headers, data=body)
    return jsonify(x.json())

#register
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
@app.route('/login', methods=['POST'])
def login():
    password = request.json['pass']
    email = request.json['email']
    user = User.query.filter_by(email=email).first()
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password,passworddb):
            control = 'login ok'
        else:
            control =  'password wrong'
    else:
        control = 'email not found'
    return {'status':f'{control}'}

#change-password
@app.route('/change-password', methods=['POST'])
def change_password():
    info = request.json
    password = request.json['pass']
    email = request.json['email']
    user = User.query.filter_by(email=email).first()
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password,passworddb):
            control = 'login ok'
            hashed_password_bytes = hash_password(info['new'])
            hashed_password = hashed_password_bytes.decode('utf-8')
            info.update({'pass' : hashed_password})
            info.pop('new')
            password = request.json['pass']
            user.password=password
            db.session.commit()
            control = 'password changed'
        else:
            control = 'wrong password'
    else:
        control = 'email incorrect'
    return {'status':f'{control}'}

#user
@app.route('/user', methods=['POST'])
def user():
    info = request.json
    password = request.json['pass']
    email = request.json['email']
    user = User.query.filter_by(email=email).first()
    if user:
        passworddb = user.password.encode('utf-8')
        if verify_password(password,passworddb):
            control = user.username
        else:
            control = 'wrong password'
    else:
        control = 'email not found'
    return {'status':f'{control}'}

# Create all tables
# with app.app_context():
#     db.drop_all()
#     db.create_all()

if __name__ == "__main__":
    app.run()