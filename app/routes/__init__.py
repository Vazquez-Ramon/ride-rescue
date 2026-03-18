from flask import render_template, request, jsonify, redirect, session, url_for
from functools import wraps
import sqlite3
import os
import json
import uuid

from app.models import db, User, UserVehicle, UserAppointment

def init_routes(app):

    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))

    VEHICLES_DB_PATH = os.path.join(BASE_DIR, "vehicles.db")
    SERVICES_DB_PATH = os.path.join(BASE_DIR, "services.db")
    
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

    # =========================
    # Helpers
    # =========================

    def allowed_file(filename):
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

    def get_db_connection(db_path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                wants_json = (
                    request.is_json
                    or request.accept_mimetypes.best == 'application/json'
                    or request.headers.get('X-Requested-With') == 'XMLHttpRequest'
                    or request.path.startswith('/api/')
                )
                if wants_json:
                    return jsonify({'message': 'Not authenticated'}), 401
                return redirect(url_for('login', next=request.url))
            return f(*args, **kwargs)
        return decorated_function

    # =========================
    # BASIC ROUTES
    # =========================

    @app.route('/')
    def home():
        return render_template('index.html')

    # =========================
    # VEHICLE DATA ROUTES
    # =========================

    @app.route('/get_years')
    def get_years():
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            years = conn.execute("SELECT DISTINCT year FROM vehicles ORDER BY year DESC").fetchall()
            return jsonify([row['year'] for row in years])
        finally:
            conn.close()

    @app.route('/get_makes')
    def get_makes():
        year = request.args.get('year')
        if not year:
            return jsonify({"error": "Year parameter is required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            makes = conn.execute("SELECT DISTINCT make FROM vehicles WHERE year=?", (year,)).fetchall()
            return jsonify([row['make'] for row in makes])
        finally:
            conn.close()

    @app.route('/get_models')
    def get_models():
        year = request.args.get('year')
        make = request.args.get('make')
        if not year or not make:
            return jsonify({"error": "Year and Make parameters are required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            models = conn.execute(
                "SELECT DISTINCT model FROM vehicles WHERE year=? AND make=?",
                (year, make)
            ).fetchall()
            return jsonify([row['model'] for row in models])
        finally:
            conn.close()

    @app.route('/get_engines')
    def get_engines():
        year = request.args.get('year')
        make = request.args.get('make')
        model = request.args.get('model')
        if not year or not make or not model:
            return jsonify({"error": "Year, Make, and Model parameters are required"}), 400
        conn = get_db_connection(VEHICLES_DB_PATH)
        try:
            engines = conn.execute(
                "SELECT DISTINCT engine FROM vehicles WHERE year=? AND make=? AND model=?",
                (year, make, model)
            ).fetchall()
            return jsonify([row['engine'] for row in engines])
        finally:
            conn.close()

    @app.route('/get_categories')
    def get_categories():
        conn = get_db_connection(SERVICES_DB_PATH)
        try:
            categories = conn.execute("SELECT DISTINCT category FROM services").fetchall()
            return jsonify([row['category'] for row in categories])
        finally:
            conn.close()

    @app.route('/get_services')
    def get_services():
        category = request.args.get('category')
        if not category:
            return jsonify({"error": "Category parameter is required"}), 400
        conn = get_db_connection(SERVICES_DB_PATH)
        try:
            cur = conn.execute(
                "SELECT service_name, description, estimated_labor_hours FROM services WHERE category=?",
                (category,)
            )
            services = [
                {
                    "name": row["service_name"],
                    "description": row["description"],
                    "estimated_labor_hours": row["estimated_labor_hours"]
                }
                for row in cur.fetchall()
            ]
            return jsonify(services)
        finally:
            conn.close()

    # =========================
    # AUTH ROUTES (FIXED)
    # =========================

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            try:
                email = request.json.get('email')
                password = request.json.get('password')

                user = User.query.filter_by(email=email).first()

                if user and user.check_password(password):
                    session.clear()  # 🔥 security fix
                    session['user_id'] = user.id

                    return jsonify({
                        'success': True,
                        'message': 'Login successful!',
                        'redirect_url': url_for('user_dashboard')
                    })

                return jsonify({'success': False, 'message': 'Incorrect email or password.'}), 401

            except Exception as e:
                print(f"Login error: {e}")
                return jsonify({'message': 'Server error during login'}), 500

        return render_template('login.html')

    @app.route('/logout')
    def logout():
        session.clear()
        return redirect(url_for('login'))

    # =========================
    # DASHBOARD
    # =========================

    @app.route('/dashboard')
    @login_required
    def user_dashboard():
        user = User.query.get(session['user_id'])  # 👈 REQUIRED
        return render_template('dashboard.html', user=user)
    
    @app.route('/api/user_info')
    def get_user_info():
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user.id,
            'name': user.name,  # 👈 THIS MATCHES YOUR FRONTEND
            'email': user.email,
            'profile_image': user.profile_image or 'default_avatar.png'
        })

    # =========================
    # 🔥 NEW: USER API (KEY FIX)
    # =========================

    @app.route('/api/user')
    def get_user():
        user_id = session.get('user_id')

        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user.id,
            'first_name': user.name,  # 👈 your model uses "name"
            'email': user.email,
            'profile_image': user.profile_image or 'default_avatar.png'
        })
    
    @app.route('/api/vehicles', methods=['GET'])
    @login_required
    def get_vehicles():
        try:
            user_id = session.get('user_id')

            # 🔒 Safety check (production ready)
            if not user_id:
                return jsonify([]), 401

            vehicles = UserVehicle.query.filter_by(user_id=user_id).all()

            # ✅ Ensure safe serialization
            result = []
            for v in vehicles:
                try:
                    result.append(v.to_dict())
                except Exception as e:
                    print(f"[ERROR] Vehicle serialization failed: {e}")

            return jsonify(result)

        except Exception as e:
            print(f"[ERROR] /api/vehicles: {e}")
            return jsonify([]), 500
        
    @app.route('/api/appointments', methods=['GET'])
    @login_required
    def get_appointments():
        try:
            user_id = session.get('user_id')

            # 🔒 Safety check
            if not user_id:
                return jsonify([]), 401

            appointments = UserAppointment.query.filter_by(user_id=user_id).all()

            result = []

            for a in appointments:
                services = []

                # ✅ SAFELY HANDLE MIXED DATA (THIS FIXES YOUR ISSUE)
                if a.services_needed:
                    try:
                        # Case 1: Proper JSON
                        services = json.loads(a.services_needed)
                    except Exception:
                        # Case 2: Old comma-separated string
                        services = [{"name": s.strip()} for s in a.services_needed.split(',') if s.strip()]

                result.append({
                    'id': a.id,
                    'appointmentDate': a.appointment_date,
                    'appointmentTime': a.appointment_time,
                    'services': services,
                    'vehicleInfo': a.vehicle_info,
                    'status': a.status or "Pending",
                    'total': float(a.total_cost) if a.total_cost else 0.0
                })

            return jsonify(result)

        except Exception as e:
            print(f"[ERROR] /api/appointments: {e}")
            return jsonify([]), 500

    # =========================
    # OTHER PAGES
    # =========================

    @app.route('/garage')
    @login_required
    def user_garage():
        return render_template('garage.html')