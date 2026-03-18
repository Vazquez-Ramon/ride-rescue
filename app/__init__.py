from flask import Flask
from flask_cors import CORS
import os
from app.models import db, bcrypt
from app.routes import init_routes


def create_app():
    app = Flask(__name__)
    CORS(app)

    # Ensure instance folder exists
    os.makedirs(app.instance_path, exist_ok=True)

    # Config
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(app.instance_path, 'users.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = 'static/avatars'
    app.secret_key = os.urandom(24)

    # Init extensions
    db.init_app(app)
    bcrypt.init_app(app)

    # Create DB
    with app.app_context():
        db.create_all()

    # Import routes
    init_routes(app)

    return app