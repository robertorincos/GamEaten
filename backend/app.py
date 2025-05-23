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

class Comments(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    id_game = db.Column(db.Integer, unique=False, nullable=False)
    username = db.Column(db.String(80), unique=False, nullable=False)
    Comment = db.Column(db.String(255), unique=False, nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Comment {self.id}>'

    def to_dict(self):
        # Get the actual username from the User model
        user = User.query.filter_by(id=self.username).first()
        display_username = user.username if user else f"User {self.username}"
        
        return {
            "id": self.id, 
            "id_game": self.id_game, 
            "user_id": self.username,  # Keep the original ID for reference
            "username": display_username,  # Add the actual username
            "comment": self.Comment, 
            "date_created": self.date_created.strftime('%Y-%m-%d %H:%M:%S')
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
    comment.Comment = request.json['new_comment']
    db.session.commit()
    return {"status":"comentario atualizado"}, 200

# remover um comentario feito por voce
@app.route('/api/comment/<int:id>', methods=['DELETE'])
@token_required
def delete(id):
    #apenas o criador deletar
    comment = Comments.query.get_or_404(id)
    db.session.delete(comment)
    db.session.commit()
    return {"status":"comentario deletado"}, 200


@app.route('/api/comment', methods=['POST'])
@token_required
def comment():
    if not request.is_json:
        return jsonify({"status": "Request must be JSON"}), 400
        
    # Verificar campos obrigatórios
    required_fields = ['id_game', 'comment']
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
    
    # Validar o comentário
    comment_text = request.json['comment']
    if len(comment_text) > 255:  # Limitar de acordo com o modelo de dados
        return jsonify({"status": "Comment too long (max 255 characters)"}), 400
    
    # Sanitizar o comentário - remover HTML/scripts potencialmente perigosos
    # Você pode usar bibliotecas como bleach para isso
    # Exemplo simplificado:
    import html
    sanitized_comment = html.escape(comment_text)
    
    try:
        new_comment = Comments(username=user_id, id_game=id_game, Comment=sanitized_comment)
        db.session.add(new_comment)
        db.session.commit()
        return {'status': 'comentario criado'}, 201  # Código 201 é mais apropriado para criação
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": f"Error creating comment: {str(e)}"}), 500

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
    else:
        # GET method - parameters come from query string
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
    
    username = request.token_data['user']
    offset = (page - 1) * size
    
    # Continuar com a lógica existente para cada tipo de busca...
    
    if busca == "game":
        total_comments = Comments.query.filter_by(id_game=id_game).count()
        comments = Comments.query.filter_by(id_game=id_game).order_by(Comments.date_created.desc()).offset(offset).limit(size).all()
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
    elif busca == "user":
        total_comments = Comments.query.filter_by(username=username).count()
        comments = Comments.query.filter_by(username=username).order_by(
            Comments.date_created.desc()
        ).offset(offset).limit(size).all()
        
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
    elif busca == "ambos":
        # For the home feed, we want to show all comments
        if id_game and id_game > 0:
            # If a specific game is requested
            total_comments = Comments.query.filter_by(id_game=id_game, username=username).count()
            comments = Comments.query.filter_by(id_game=id_game, username=username).order_by(
                Comments.date_created.desc()
            ).offset(offset).limit(size).all()
        else:
            # In case id_game is 0, return all comments for the home feed
            total_comments = Comments.query.count()
            comments = Comments.query.order_by(
                Comments.date_created.desc()
            ).offset(offset).limit(size).all()
        
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

# Create all tables
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=False)
